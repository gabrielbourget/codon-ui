"""Pure plist/validation/source-order controls. No SDK, guest or process commands."""
import copy
from pathlib import Path
import plistlib
import sys
import unittest

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import NativeXCTestBatch as batch

PACKET={'useDestinationArtifacts':True,'observerBundleID':'dev.codonui.lab.components.xctrunner','appBundleID':'dev.codonui.showcase'}
SOURCE={'TestHostPath':'/prepared/Runner.app','TestBundlePath':'__TESTHOST__/PlugIns/CodonNativeComponents.xctest','UITargetAppPath':'/prepared/App.app','TestHostBundleIdentifier':'dev.codonui.lab.components.xctrunner','OnlyTestIdentifiers':['TagG02TrialTests/testT01BaselineFirstActionVetoAndSemantics'],'UserAttachmentLifetime':'keepAlways'}

class DestinationControls(unittest.TestCase):
 def target(self):return batch.apply_destination_artifacts(copy.deepcopy(SOURCE),PACKET)
 def test_documented_four_keys_three_exclusions(self):
  target=plistlib.loads(plistlib.dumps(self.target()))
  self.assertIs(target['UseDestinationArtifacts'],True)
  self.assertEqual(target['TestHostBundleIdentifier'],PACKET['observerBundleID'])
  self.assertEqual(target['TestBundleDestinationRelativePath'],'__TESTHOST__/PlugIns/CodonNativeComponents.xctest')
  self.assertEqual(target['UITargetAppBundleIdentifier'],PACKET['appBundleID'])
  for key in ['TestHostPath','TestBundlePath','UITargetAppPath']:self.assertNotIn(key,target)
  self.assertEqual(target['OnlyTestIdentifiers'],SOURCE['OnlyTestIdentifiers'])
 def test_default_off_byte_equivalent_fields(self):
  packet={k:v for k,v in PACKET.items() if k!='useDestinationArtifacts'}
  self.assertEqual(batch.apply_destination_artifacts(copy.deepcopy(SOURCE),packet),SOURCE)
 def test_explicit_false_preserves_normal_route(self):self.assertEqual(batch.apply_destination_artifacts(copy.deepcopy(SOURCE),{**PACKET,'useDestinationArtifacts':False}),SOURCE)
 def test_wrong_observer_rejected(self):
  target=self.target();target['TestHostBundleIdentifier']='wrong.bundle'
  with self.assertRaises(AssertionError):batch.validate_destination_artifacts(target,PACKET)
 def test_wrong_ui_app_rejected(self):
  target=self.target();target['UITargetAppBundleIdentifier']='wrong.app'
  with self.assertRaises(AssertionError):batch.validate_destination_artifacts(target,PACKET)
 def test_wrong_test_bundle_rejected(self):
  target=self.target();target['TestBundleDestinationRelativePath']='__TESTHOST__/PlugIns/Other.xctest'
  with self.assertRaises(AssertionError):batch.validate_destination_artifacts(target,PACKET)
 def test_missing_mode_rejected(self):
  target=self.target();target.pop('UseDestinationArtifacts')
  with self.assertRaises(AssertionError):batch.validate_destination_artifacts(target,PACKET)
 def test_each_prepared_path_forbidden(self):
  for key in ['TestHostPath','TestBundlePath','UITargetAppPath']:
   with self.subTest(key=key):
    target=self.target();target[key]='/prepared/fallback'
    with self.assertRaises(AssertionError):batch.validate_destination_artifacts(target,PACKET)
 def test_non_boolean_mode_rejected(self):
  for value in ['true',1,None]:
   with self.subTest(value=value):
    with self.assertRaises(AssertionError):batch.destination_artifacts_enabled({**PACKET,'useDestinationArtifacts':value})
 def test_bound_enabled_mode_cannot_run_without_packet_optin(self):
  with self.assertRaises(AssertionError):batch.validate_destination_artifacts(self.target(),{k:v for k,v in PACKET.items() if k!='useDestinationArtifacts'})
 def test_runtime_identity_gate_before_any_selected_sdk(self):
  source=(ROOT/'NativeXCTestBatch.py').read_text()
  start=source.index('def main():');source=source[start:]
  gate=source.index("exact_installed('observer',packet['observerBundleID'],'observer-identity.json',suffix='-before')")
  self.assertLess(source.index("run('boot-readiness'"),gate)
  self.assertLess(source.index('wait_for_pending_transaction(pending,pendingDeadline)'),gate)
  self.assertLess(gate,source.index("result=tests('xctest'"))
  self.assertIn("validate_destination_artifacts(xrun['CodonNativeComponents'],packet)",source)
  self.assertIn("binding.get('useDestinationArtifacts',False) is destination_artifacts_enabled(packet)",source)
  self.assertIn("'registered-'+label+suffix",source)
  self.assertIn("'installed-'+label+suffix+'.json'",source)

class ExplicitInstallControls(unittest.TestCase):
 def test_default_never_installs(self):self.assertFalse(batch.explicit_observer_install_enabled(PACKET))
 def test_explicit_destination_only(self):self.assertTrue(batch.explicit_observer_install_enabled({**PACKET,'installPreparedObserver':True}))
 def test_normal_route_rejects_install(self):
  with self.assertRaises(AssertionError):batch.explicit_observer_install_enabled({'installPreparedObserver':True})
 def test_string_opt_in_rejected(self):
  with self.assertRaises(AssertionError):batch.explicit_observer_install_enabled({**PACKET,'installPreparedObserver':'true'})
 def test_install_finishes_before_exact_registration_and_tests(self):
  source=(ROOT/'NativeXCTestBatch.py').read_text()
  self.assertLess(source.index("install=run('install-observer-direct'"),source.index("exact_installed('observer',packet['observerBundleID'],'observer-identity.json',suffix='-before')"))
  self.assertIn("assert install['exitCode']==0 and not install.get('timedOut')",source)

if __name__=='__main__':unittest.main(verbosity=2)
