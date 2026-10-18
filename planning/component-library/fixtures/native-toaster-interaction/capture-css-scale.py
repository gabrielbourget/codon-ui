from pathlib import Path
import argparse
import hashlib
import html
import json
import re
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument("--browser", default="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
parser.add_argument("--output", type=Path, required=True)
arguments = parser.parse_args()
repository = Path(__file__).resolve().parents[4]
source = repository / "packages/react/src/components/Toaster/Toast/ToastStyles.module.css"
css = source.read_text()
with tempfile.TemporaryDirectory(prefix="codon-toast-css-") as temporary:
    root = Path(temporary)
    document = '<html><head><style>:root{--width:325px;--toastGap:15px;--firstToastHeight:100px}' + css + '</style></head><body>'
    for index in [0, 1, 2, 4, 20]:
        document += f'<div class="toast" data-y-position="top" data-mounted="true" data-visible="true" data-expanded="false" data-front="false" style="--toastsBefore:{index}">{index}</div>'
    document += '<pre id="output"></pre><script>document.getElementById("output").textContent=JSON.stringify({agent:navigator.userAgent,frames:[...document.querySelectorAll(".toast")].map(node=>({index:Number(node.textContent),scale:getComputedStyle(node).getPropertyValue("--scale"),transform:getComputedStyle(node).transform}))})</script></body></html>'
    page = root / "scale.html"
    page.write_text(document)
    result = subprocess.run([arguments.browser, "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", "--user-data-dir=" + str(root / "profile"), "--dump-dom", "--virtual-time-budget=1000", page.as_uri()], capture_output=True, text=True, timeout=60, check=True)
    match = re.search(r'<pre id="output">(.*?)</pre>', result.stdout, re.S)
    assert match, result.stderr
    observation = json.loads(html.unescape(match[1]))
    for frame in observation["frames"]:
        matrix = re.fullmatch(r'matrix\(([^)]+)\)', frame["transform"])
        assert matrix, frame
        frame["matrix"] = [float(value.strip()) for value in matrix[1].split(",")]
    observation.update({"source": str(source.relative_to(repository)), "sourceSHA256": hashlib.sha256(source.read_bytes()).hexdigest(), "scope": "Actual browser computed transforms for the unmodified canonical CSS; no native rendering inference."})
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(observation, indent=2) + "\n")
    print(json.dumps(observation))
