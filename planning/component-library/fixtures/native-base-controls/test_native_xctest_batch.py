"""Offline controls only: actual packet functions/admission/exit; no SDK or process launch."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
SUPPORT = ROOT if (ROOT/'NativeCellVerification.py').is_file() else Path.cwd()/'planning/component-library/fixtures/native-base-controls'
sys.path.insert(0,str(ROOT));sys.path.insert(0,str(SUPPORT))
import NativeXCTestBatch as batch
import NativeCellVerification as admission
METHODS=['TagG02TrialTests/testT01BaselineFirstActionVetoAndSemantics']
RAW="Test Case '-[CodonNativeComponents.TagG02TrialTests testT01BaselineFirstActionVetoAndSemantics]' passed (2.500 seconds)."
SUMMARY={'result':'Passed','totalTestCount':1,'passedTests':1,'failedTests':0,'skippedTests':0}
SAVED=json.loads((ROOT/'NativeXCTestFailureControls.json').read_text())

class Controls(unittest.TestCase):
 def test_android_pending_review_statuses_preserve_method_limits(self):
  with tempfile.TemporaryDirectory(prefix='codon-native-status-') as tmp:
   source=Path(tmp)/'receipt.json'
   for status in ['NATIVE_ASSERTIONS_PASSED_PENDING_COLOR_AND_ROOT_REVIEW','NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW','FAILED_ASSERTION']:
    source.write_text(json.dumps({'cohorts':[{'name':'actual','status':status,'elapsedMs':1000}]}))
    binding={'path':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'format':'android_receipt','method':'actual','maximumSeconds':180}
    if status=='FAILED_ASSERTION':
     with self.assertRaises(ValueError):admission.native_method(binding)
    else:self.assertEqual(admission.native_method(binding)['seconds'],1)
 def test_exact_input_bytes_and_changed_source_rejected(self):
  with tempfile.TemporaryDirectory(prefix='codon-xctest-binding-') as tmp:
   source=Path(tmp)/'source.swift';source.write_text('actual frozen observer')
   binding={'path':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
   self.assertEqual(batch.read_bound(binding),source.resolve())
   source.write_text('changed observer')
   with self.assertRaises(AssertionError):batch.read_bound(binding)
 def test_selection_positive(self): self.assertTrue(batch.validate_selection(METHODS,METHODS))
 def test_selection_changed_rejected(self):
  with self.assertRaises(AssertionError): batch.validate_selection(['TagG02TrialTests/testOther'],METHODS)
 def test_selection_duplicate_rejected(self):
  with self.assertRaises(AssertionError): batch.validate_selection(METHODS+METHODS,METHODS)
 def test_raw_and_structured_positive(self): self.assertEqual(batch.reconcile_selected_results(SUMMARY,RAW,METHODS)['status'],'PASS')
 def test_wrong_class_rejected(self): self.assertEqual(batch.reconcile_selected_results(SUMMARY,RAW.replace('TagG02TrialTests','OtherClass'),METHODS)['status'],'FAIL')
 def test_duplicate_method_rejected(self): self.assertEqual(batch.reconcile_selected_results(SUMMARY,RAW+'\n'+RAW,METHODS)['status'],'FAIL')
 def test_skipped_rejected(self): self.assertEqual(batch.reconcile_selected_results(SUMMARY,RAW.replace('passed','skipped'),METHODS)['status'],'FAIL')
 def test_over180_rejected(self): self.assertEqual(batch.reconcile_selected_results(SUMMARY,RAW.replace('2.500','180.001'),METHODS)['status'],'FAIL')
 def test_saved_sdk65_preserved(self):
  row=SAVED['sdk65']['selectedFieldsCopiedVerbatim']
  self.assertEqual(row['exitCode'],65);self.assertEqual(admission.driver_exit_code(row['exitCode'],True,True),65)
 def test_saved_native_timeout_never_raw_pass(self):
  saved=SAVED['nativeTimeoutDespiteRawPassed']
  result=batch.reconcile_selected_results(SUMMARY,'\n'.join(saved['rawLinesCopiedVerbatim']),saved['selectedMethods'])
  self.assertEqual(result['status'],'FAIL');self.assertTrue(result['timeoutDiagnostics'])
  self.assertTrue(any(r['durationSeconds']>180 for r in result['rawMethodResults']))
 def test_wrapper_failure_nonzero(self):
  self.assertEqual(admission.driver_exit_code(0,False,True),1)
  self.assertEqual(admission.driver_exit_code(0,True,False),1)
 def test_missing_same_owner_preflight_rejected(self):
  with patch.dict(os.environ,{},clear=True):
   with self.assertRaises(ValueError):admission.load_admission(str(ROOT/'NativeXCTestBatch.py'),'CAT.tag.G02',{'ios':METHODS,'android':[]})
 def test_actual_same_owner_preflight_and_changed_selected(self):
  driver=ROOT/'NativeXCTestBatch.py';cohorts={'ios':METHODS,'android':[]};argv=['python3',str(driver),'/tmp/UNIT_CONTROL_NO_SDK_PACKET.json']
  value={'status':'PASS','cell':'CAT.tag.G02','checklistVersion':admission.VERSION,'checklistSHA256':admission.digest(admission.CHECKLIST),'driverSHA256':admission.digest(driver),'ownerPID':os.getpid(),'driverArgv':argv,'driverCohorts':cohorts,'attempt':{'maximumSeconds':1800,'cleanupReserveSeconds':120}}
  with tempfile.TemporaryDirectory(prefix='codon-tag-offline-control-') as tmp:
   p=Path(tmp)/'synthetic-preflight.json';p.write_text(json.dumps(value))
   with patch.dict(os.environ,{'CODON_NATIVE_CELL_PREFLIGHT_RECEIPT':str(p)}),patch.object(sys,'argv',argv[1:]):
    self.assertEqual(admission.load_admission(str(driver),'CAT.tag.G02',cohorts)['result'],'PASS')
    with self.assertRaises(ValueError):admission.load_admission(str(driver),'CAT.tag.G02',{'ios':['TagG02TrialTests/testChanged'],'android':[]})
    value['ownerPID']+=1;p.write_text(json.dumps(value))
    with self.assertRaises(ValueError):admission.load_admission(str(driver),'CAT.tag.G02',cohorts)

if __name__=='__main__':unittest.main(verbosity=2)
