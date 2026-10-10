// Extracted from the local Bioma main.js: wind, rustling leaves and birds.
const random=()=>Math.random();
const rand=(min,max)=>min+random()*(max-min);
export class ForestAmbience {
  constructor() {
    this.context = null;
    this.master = null;
    this.windGain = null;
    this.rustleGain = null;
    this.active = false;
    this.volume = .55;
    this.birdTimer = null;
  }

  createNoiseBuffer(seconds = 5) {
    const length = this.context.sampleRate * seconds;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * .985 + white * .015;
      data[i] = white * .38 + last * 2.1;
    }
    return buffer;
  }

  async start() {
    if(this.active)return;
    if (!this.context) this.build();
    await this.context.resume();
    this.active = true;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .35);
    this.scheduleBird();
  }

  stop() {
    if (!this.context) return;
    this.active = false;
    clearTimeout(this.birdTimer);
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0, this.context.currentTime, .25);
  }

  build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx)throw Error('Áudio ambiente indisponível neste navegador.');
    this.context = new AudioCtx();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);

    // Vento grave e largo.
    const wind = this.context.createBufferSource();
    wind.buffer = this.createNoiseBuffer(6); wind.loop = true;
    const windFilter = this.context.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = .42;
    this.windGain = this.context.createGain(); this.windGain.gain.value = .18;
    wind.connect(windFilter).connect(this.windGain).connect(this.master);
    wind.start();

    // Folhas: ruído mais agudo que responde às rajadas.
    const rustle = this.context.createBufferSource();
    rustle.buffer = this.createNoiseBuffer(3); rustle.loop = true;
    const rustleFilter = this.context.createBiquadFilter();
    rustleFilter.type = 'highpass'; rustleFilter.frequency.value = 1850;
    this.rustleGain = this.context.createGain(); this.rustleGain.gain.value = .035;
    rustle.connect(rustleFilter).connect(this.rustleGain).connect(this.master);
    rustle.start();

    // Uma oscilação lenta torna o vento orgânico.
    const gust = this.context.createOscillator();
    const gustDepth = this.context.createGain();
    gust.type = 'sine'; gust.frequency.value = .085; gustDepth.gain.value = .065;
    gust.connect(gustDepth).connect(this.windGain.gain);
    gust.start();
  }

  setVolume(value) {
    this.volume = value;
    if (this.context && this.active) this.master.gain.setTargetAtTime(value, this.context.currentTime, .08);
  }

  setWind(value) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.windGain.gain.setTargetAtTime(.07 + value * .25, now, .2);
    this.rustleGain.gain.setTargetAtTime(.012 + value * .075, now, .18);
  }

  birdCall() {
    if (!this.active) return;
    const now = this.context.currentTime;
    const pan = this.context.createStereoPanner();
    const gain = this.context.createGain();
    pan.pan.value = rand(-.9, .9);
    gain.gain.setValueAtTime(0, now);
    gain.connect(pan).connect(this.master);

    const notes = random() > .45 ? [0, .13, .27] : [0, .1, .2, .34];
    const base = rand(1450, 2450);
    notes.forEach((offset, index) => {
      const osc = this.context.createOscillator();
      const noteGain = this.context.createGain();
      osc.type = index % 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(base * rand(.88, 1.12), now + offset);
      osc.frequency.exponentialRampToValueAtTime(base * rand(1.25, 1.7), now + offset + .075);
      noteGain.gain.setValueAtTime(0, now + offset);
      noteGain.gain.linearRampToValueAtTime(rand(.025,.055), now + offset + .018);
      noteGain.gain.exponentialRampToValueAtTime(.001, now + offset + .14);
      osc.connect(noteGain).connect(gain);
      osc.start(now + offset); osc.stop(now + offset + .16);
    });
    gain.gain.setValueAtTime(1, now);
    gain.gain.setValueAtTime(1, now + .7);
  }

  scheduleBird() {
    clearTimeout(this.birdTimer);
    if (!this.active) return;
    this.birdTimer = setTimeout(() => {
      this.birdCall();
      if (random() > .68) setTimeout(() => this.birdCall(), rand(500, 1100));
      this.scheduleBird();
    }, rand(2200, 6200));
  }
  dispose(){this.stop();if(this.context){void this.context.close();this.context=null;}}
}
