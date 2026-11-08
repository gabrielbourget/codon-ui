"""Realistic native metadata controls for Text geometry, paint and complete selection."""
import copy
import unittest
from NativeTextStyleCheck import CONTENT, NAMES, validate_rows


class TextStyleTests(unittest.TestCase):
    def rows(self, platform):
        rows=[]
        for name in NAMES:
            width=280 if name=="compact" else 342
            height=52 if name=="custom" else 34
            row={"name":name,"text":CONTENT,"frame":[20,250,width,height],"scale":3,"expectedRGB":0xffffff if name=="dark" else 0x171717,"foregroundPixels":327,"captureEpochMs":1793948400000,"imageWidth":1170,"imageHeight":2532,"stableFrameAndContent":True,"nativeElementType":48}
            if platform=="android": row.update(frame=[35,438,35+width*1.75,438+height*1.75],scale=1.75,imageWidth=720,imageHeight=1600,className="android.widget.TextView")
            rows.append(row)
        return rows

    def test_actual_platform_shapes_and_native_metadata(self):
        for platform in ["ios","android"]:
            self.assertEqual(validate_rows(self.rows(platform),platform)["observations"],8)
            self.assertEqual(validate_rows(list(reversed(self.rows(platform))),platform)["observations"],8)

    def test_wrong_targets_paint_geometry_reset_and_incomplete_selection_reject(self):
        for platform in ["ios","android"]:
            cases=[(0,"text","Wrong target"),(0,"foregroundPixels",0),(5,"expectedRGB",0x171717),(0,"scale",float("nan")),(0,"stableFrameAndContent",False),(0,"frame",[0,0,0,0]),(0,"frame",[-1,250,342,34]),(0,"captureEpochMs",0),(0,"imageHeight",1),(2,"frame",[20,250,342,130])]
            for index,key,value in cases:
                with self.subTest(platform=platform,key=key):
                    rows=self.rows(platform);rows[index][key]=value
                    with self.assertRaises(ValueError):validate_rows(rows,platform)
            for rows in [self.rows(platform)[:-1],self.rows(platform)[:-1]+[self.rows(platform)[0]]]:
                with self.assertRaises(ValueError):validate_rows(rows,platform)
            rows=self.rows(platform);rows[6]["frame"]=copy.deepcopy(rows[4]["frame"])
            with self.assertRaises(ValueError):validate_rows(rows,platform)
        rows=self.rows("android");rows[0]["className"]="android.view.View"
        with self.assertRaises(ValueError):validate_rows(rows,"android")


if __name__=="__main__": unittest.main()
