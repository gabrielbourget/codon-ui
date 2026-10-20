// Post-run native PNG/journal joins and binary-boundary distances; never a drawing acceptance threshold.
import Foundation
import CoreGraphics
import ImageIO
struct AlphaImage {
 let width:Int
 let height:Int
 let alpha:[Int]
}
func load(_ path:URL)->AlphaImage {
 let image=CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(path as CFURL,nil)!,0,nil)!
 let width=image.width,height=image.height
 var bytes=[UInt8](repeating:0,count:width*height*4)
 bytes.withUnsafeMutableBytes{buffer in
  let context=CGContext(data:buffer.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue)!
  context.setBlendMode(.copy)
  context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
 }
 return AlphaImage(width:width,height:height,alpha:stride(from:3,to:bytes.count,by:4).map{Int(bytes[$0])})
}
func boundaries(_ image:AlphaImage)->[Int] {
 let mask=image.alpha.map{$0>=128};var result:[Int]=[]
 for y in 0..<image.height{for x in 0..<image.width{
  let i=y*image.width+x
  if !mask[i]{continue}
  if x==0 || y==0 || x==image.width-1 || y==image.height-1 || !mask[i-1] || !mask[i+1] || !mask[i-image.width] || !mask[i+image.width]{result.append(i)}
 }}
 return result
}
func distances(_ seeds:[Int],width:Int,height:Int)->[Int] {
 var d=[Int](repeating:width+height,count:width*height)
 for i in seeds{d[i]=0}
 for y in 0..<height{for x in 0..<width{
  let i=y*width+x
  if x>0{d[i]=min(d[i],d[i-1]+1)}
  if y>0{
   d[i]=min(d[i],d[i-width]+1)
   if x>0{d[i]=min(d[i],d[i-width-1]+1)}
   if x+1<width{d[i]=min(d[i],d[i-width+1]+1)}
  }
 }}
 for y in (0..<height).reversed(){for x in (0..<width).reversed(){
  let i=y*width+x
  if x+1<width{d[i]=min(d[i],d[i+1]+1)}
  if y+1<height{
   d[i]=min(d[i],d[i+width]+1)
   if x>0{d[i]=min(d[i],d[i+width-1]+1)}
   if x+1<width{d[i]=min(d[i],d[i+width+1]+1)}
  }
 }}
 return d
}
for (width,height,seeds) in [(7,9,[0,21,62]),(9,5,[10,34]),(1,8,[2,7])] {
 let actual=distances(seeds,width:width,height:height)
 for index in actual.indices {
  let expected=seeds.map{max(abs(index%width-$0%width),abs(index/width-$0/width))}.min()!
  precondition(actual[index]==expected,"Boundary distance differs from the independent grid definition")
 }
}
let root=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
let journal=try JSONSerialization.jsonObject(with:Data(contentsOf:root.appendingPathComponent("original-native-journal.json"))) as! [[String:Any]]
var results:[[String:Any]]=[]
for row in journal where ["profile","raster-control","native-layer-candidate","native-mask-candidate","factory-mask-candidate"].contains(row["kind"] as? String ?? "") {
 let name=row["name"] as! String
 let a=load(root.appendingPathComponent(row["referenceImage"] as? String ?? name+"-native.png")),b=load(root.appendingPathComponent(row["ownedImage"] as? String ?? name+"-owned.png"))
 precondition(a.width==b.width && a.height==b.height)
 var binary=0,different=0,significant=0,total=0,maximum=0
 for i in a.alpha.indices{
  let delta=abs(a.alpha[i]-b.alpha[i]);total+=delta;maximum=max(maximum,delta)
  if delta>0{different+=1};if delta>16{significant+=1}
  if (a.alpha[i]>=128) != (b.alpha[i]>=128){binary+=1}
 }
 let measured=["differentAlphaPixels":different,"significantAlphaPixels":significant,"binaryCoverageDifferences":binary,"totalAlphaDifference":total,"maximumAlphaDifference":maximum,"pixels":a.width*a.height]
 let original=row["metrics"] as! [String:Int]
 precondition(measured==original,"Native PNGs do not reproduce original native pixel journal")
 let aa=boundaries(a),bb=boundaries(b),ad=distances(aa,width:a.width,height:a.height),bd=distances(bb,width:a.width,height:a.height)
 let values=aa.map{bd[$0]}+bb.map{ad[$0]}
 results.append(["kind":row["kind"]!,"name":name,"nativePNGMatchesOriginalJournal":true,"symmetricBoundaryPixels":values.count,"maximumChebyshevBoundaryDistancePixels":values.max()!,"boundaryPixelsBeyondOnePixel":values.filter{$0>1}.count,"boundaryPixelsBeyondTwoPixels":values.filter{$0>2}.count,"nativePixelScale":3,"metrics":measured])
}
let output:[String:Any]=["kind":"post-run-native-pixel-analysis","scope":"Exact native PNG/journal join and 8-connected binary coverage boundary distances only; no drawing tolerance or acceptance decision","profiles":results,"fullCard":false,"fullGoal":false]
print(String(data:try JSONSerialization.data(withJSONObject:output,options:[.sortedKeys]),encoding:.utf8)!)
