export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function jaVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ja'));
}

export function speak(text: string, rate = 1, voiceName = '') {
  if (!speechAvailable()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = rate;
  const v = jaVoices().find((x) => x.name === voiceName);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechAvailable()) speechSynthesis.cancel();
}

/** {キー} を値に置き換える */
export function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{([^}]+)\}/g, (_, k) => String(vars[k] ?? ''));
}
