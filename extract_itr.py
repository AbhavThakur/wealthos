import zlib, re, sys

path = sys.argv[1]
with open(path, "rb") as f:
    pdf_data = f.read()

streams = []
start = 0
while True:
    idx = pdf_data.find(b"stream\r\n", start)
    if idx == -1:
        idx = pdf_data.find(b"stream\n", start)
    if idx == -1:
        break
    stream_start = idx + (8 if pdf_data[idx+6:idx+8] == b"\r\n" else 7)
    end_idx = pdf_data.find(b"endstream", stream_start)
    if end_idx == -1:
        break
    raw = pdf_data[stream_start:end_idx]
    try:
        decoded = zlib.decompress(raw).decode("latin-1", errors="replace")
        streams.append(decoded)
    except:
        pass
    start = end_idx + 9

all_text = []
for s in streams:
    for m in re.finditer(r"BT\s(.*?)ET", s, re.DOTALL):
        block = m.group(1)
        for tj in re.finditer(r"\((.*?)\)\s*Tj", block):
            all_text.append(tj.group(1))
        for tj_arr in re.finditer(r"\[(.*?)\]\s*TJ", block, re.DOTALL):
            arr = tj_arr.group(1)
            for part in re.finditer(r"\((.*?)\)", arr):
                all_text.append(part.group(1))

print("\n".join(all_text[:800]))
