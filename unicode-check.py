from pathlib import Path
print(Path('unicode-check.txt').read_text(encoding='utf-8').encode('unicode_escape'))