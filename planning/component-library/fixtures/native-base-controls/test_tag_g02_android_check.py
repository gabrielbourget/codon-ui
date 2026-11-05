"""Offline schema/adversarial controls only; no guest or fabricated native evidence."""
import copy,importlib.util,sys,unittest
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('tag_check',Path(__file__).with_name('TagG02AndroidCheck.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def sample():
 cohorts=[]
 for name,expected in m.EXPECTED.items():
  rows=[]
  for label,requests,owner,echo,exposed,enabled in expected:
   long=label.startswith('long-');frame='10 20 290 140' if long else '10 20 170 60'
   state={'requests':requests,'owner':owner,'echo':echo,'exposed':exposed,'id':'number 0','last':'none' if requests==0 else 'number 0','armed':False,'rawText':'Synthetic schema control only','nativeUptimeMs':10,'size':'140' if long else 'automatic','frameWidth':140 if long else 80,'frameHeight':60 if long else 20}
   node={'id':'tag-example','className':'android.widget.Button','contentDescription':'Controlled tag','enabled':enabled,'checkable':True,'checked':False if exposed=='false' else owner,'visible':True,'bounds':frame,'nativeEpochMs':15}
   rows.append({'name':label,'state':state,'target':node,'sameNativeAXSource':True,'scroll':{'bounds':'0 0 400 800'},'captureStartedEpochMs':10,'captureFinishedEpochMs':20,'windows':{'windowNodes':[{'id':'tag-example'}]},'png':label+'.png'})
  row={'name':name,'status':'NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW','elapsedMs':20000,'observations':rows}
  if name=='baseline-actions':row['staticNode']={'id':'tag-status','contentDescription':'Tag status inactive','clickable':False,'actions':[]}
  if name=='guard-cancel-lifetime':
   contacts=[]
   for takeover in [True,False]:
    c={'takeover':takeover,'downAccepted':True,'releaseAccepted':True,'toolType':1,'source':4098,'pointerId':0,'releaseAction':1 if takeover else 3,'downUptimeMs':1,'heldSnapshotFinishedUptimeMs':20,'releaseUptimeMs':25,'finishedUptimeMs':30,'before':{'requests':0,'owner':False},'after':{'requests':0,'owner':False},'heldState':{'requests':0,'owner':False,'armed':False,'nativeUptimeMs':15},'heldTarget':{'enabled':False}}
    contacts.append(c)
   row['contacts']=contacts;row['retirement']={'absent':True,'quietAbsent':True,'windows':{'windowNodes':[]},'quietWindows':{'windowNodes':[]}}
  cohorts.append(row)
 return {'operation':'tag-g02-batch','connectionAdmission':'READY_FROM_ACTUAL_NEW_CONNECTION','methodLimitMs':180000,'batchLimitMs':560000,'elapsedMs':65000,'cohorts':cohorts,'nativeActionSucceeded':True,'hasFailedCohorts':False,'status':'NATIVE_COMPLETE_PENDING_HOST_VISUAL_AND_SOURCE_JOIN'}

class Controls(unittest.TestCase):
 def test_positive(self):self.assertEqual(m.reconcile(sample(),2)['status'],'AUTOMATED_TAG_G02_PENDING_VISUAL_AND_SOURCE_JOIN')
 def changed(self,change):
  raw=sample();change(raw)
  try:self.assertNotEqual(m.reconcile(raw,2)['status'],'AUTOMATED_TAG_G02_PENDING_VISUAL_AND_SOURCE_JOIN')
  except (ValueError,KeyError):pass
 def test_owner_veto_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][4]['state'].update(owner=True))
 def test_typed_callback_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][2]['state'].update(last='string "0"'))
 def test_alias_native_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][6]['target'].update(checked=True))
 def test_static_click_negative(self):self.changed(lambda r:r['cohorts'][0]['staticNode'].update(actions=[16]))
 def test_released_only_negative(self):self.changed(lambda r:r['cohorts'][1]['contacts'][0].update(heldSnapshotFinishedUptimeMs=26))
 def test_disabled_before_up_negative(self):self.changed(lambda r:r['cohorts'][1]['contacts'][0]['heldTarget'].update(enabled=True))
 def test_cancel_business_negative(self):self.changed(lambda r:r['cohorts'][1]['contacts'][1]['after'].update(requests=1))
 def test_retired_native_negative(self):self.changed(lambda r:r['cohorts'][1]['retirement']['quietWindows']['windowNodes'].append({'id':'tag-example'}))
 def test_same_node_negative(self):self.changed(lambda r:r['cohorts'][2]['observations'][0].update(sameNativeAXSource=False))
 def test_width_negative(self):self.changed(lambda r:r['cohorts'][2]['observations'][1]['target'].update(bounds='10 20 280 140'))
 def test_method_limit_negative(self):self.changed(lambda r:r['cohorts'][0].update(elapsedMs=180001))
 def test_missing_cohort_negative(self):self.changed(lambda r:r['cohorts'].pop())
 def test_duplicate_native_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][0]['windows']['windowNodes'].append({'id':'tag-example'}))
if __name__=='__main__':unittest.main()
