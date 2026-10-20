const { execFileSync } = jest.requireActual<{
  execFileSync: (file: string, args: string[], options: { encoding: "utf8"; timeout: number }) => string
}>("node:child_process")
const { resolve } = jest.requireActual<{ resolve: (...parts: string[]) => string }>("node:path")
const nativeProcess = jest.requireActual<{ execPath: string }>("node:process")
declare const __dirname: string

// This executes the actual pinned resolver with explicit synthetic geometry.
// It proves source scheduling/notifications, never native Yoga or presentation.
const runPinned = (specification: Record<string, unknown[]>) => {
  const upstream = resolve(
    __dirname,
    "../../../../../node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom/dist/es",
  )
  const script = `
    import {pathToFileURL} from 'node:url';
    globalThis.requestAnimationFrame=()=>1;
    globalThis.window={getComputedStyle:node=>node.computed,pageYOffset:0,scrollTo:()=>{}};
    const base=process.argv[1];
    const {DOMKeyframesResolver}=await import(pathToFileURL(base+'/animation/keyframes/DOMKeyframesResolver.mjs'));
    const {flushKeyframeResolvers}=await import(pathToFileURL(base+'/animation/keyframes/KeyframesResolver.mjs'));
    const {motionValue}=await import(pathToFileURL(base+'/value/index.mjs'));
    const {findDimensionValueType}=await import(pathToFileURL(base+'/value/types/dimensions.mjs'));
    const values=new Map([['width',motionValue(100)],['height',motionValue(40)]]);
    const changes=[],renders=[],results={};
    let rendered={width:100,height:40};
    for(const [name,value]of values)value.on('change',next=>changes.push([name,next]));
    const element={current:{computed:{boxSizing:'border-box'}},getValue:name=>values.get(name),
      render:()=>{rendered=Object.fromEntries([...values].map(([name,value])=>[name,value.get()]));renders.push({...rendered})},
      measureViewportBox:()=>({x:{min:0,max:rendered.width==='auto'?200:rendered.width},y:{min:0,max:rendered.height==='auto'?(rendered.width==='auto'?200:rendered.width)/2:rendered.height}})};
    const resolvers=Object.entries(${JSON.stringify(specification)}).map(([name,frames])=>new DOMKeyframesResolver(frames,(frames,final)=>{results[name]={frames,final}},name,values.get(name),element));
    resolvers.forEach(resolver=>resolver.scheduleResolve());
    flushKeyframeResolvers();
    console.log(JSON.stringify({dimensionTypes:Object.entries(${JSON.stringify(specification)}).map(([name,frames])=>({name,recognized:frames.map(value=>findDimensionValueType(value)!==undefined)})),needsMeasurement:resolvers.map(resolver=>resolver.needsMeasurement),renders,changes,results,velocity:[...values.values()].map(value=>value.getVelocity())}));
    values.forEach(value=>value.destroy());
  `
  return JSON.parse(
    execFileSync(nativeProcess.execPath, ["--input-type=module", "-e", script, upstream], {
      encoding: "utf8",
      timeout: 5000,
    }),
  )
}

it("keeps a numeric width at its initial value while the actual pinned resolver measures auto height", () => {
  const actual = runPinned({ width: [100, 200], height: [40, "auto"] })
  expect(actual.needsMeasurement).toEqual([false, true])
  expect(actual.renders.at(-1)).toEqual({ width: 100, height: "auto" })
  expect(actual.results).toEqual({ width: { frames: [100, 200] }, height: { frames: [40, 50], final: "auto" } })
  expect(actual.changes).toEqual([
    ["height", "auto"],
    ["height", 40],
  ])
  expect(actual.velocity).toEqual([0, 0])
})

it("overwrites an authored first keyframe with the actual measured origin in the pinned resolver", () => {
  const actual = runPinned({ width: [10, "auto"], height: [40, 80] })
  expect(actual.needsMeasurement).toEqual([true, false])
  expect(actual.renders.at(-1)).toEqual({ width: "auto", height: 40 })
  expect(actual.results).toEqual({ width: { frames: [100, 200], final: "auto" }, height: { frames: [40, 80] } })
  expect(actual.changes).toEqual([
    ["width", "auto"],
    ["width", 100],
  ])
  expect(actual.velocity).toEqual([0, 0])
})

it("classifies a unitless numeric string as unknown and measures mixed nonzero width in the pinned resolver", () => {
  const actual = runPinned({ width: [1, "10"], fontWeight: ["400", "700"] })
  expect(actual.dimensionTypes).toEqual([
    { name: "width", recognized: [true, false] },
    { name: "fontWeight", recognized: [false, false] },
  ])
  expect(actual.needsMeasurement).toEqual([true, false])
  expect(actual.renders.at(-1)).toEqual({ width: "10", height: 40 })
  expect(actual.results.fontWeight).toEqual({ frames: ["400", "700"] })
})

it("records the pinned zero-none template exception before numeric-string dimension classification", () => {
  const actual = runPinned({ width: [0, "10"] })
  expect(actual.dimensionTypes).toEqual([{ name: "width", recognized: [true, false] }])
  expect(actual.needsMeasurement).toEqual([false])
  expect(actual.renders).toEqual([])
  expect(actual.results.width).toEqual({ frames: ["0", "10"] })
})
