const audioContext = new AudioContext();
const analyser = audioContext.createScriptProcessor(4096, 1, 1);
analyser.connect(audioContext.destination);

const state = {
  audioContext,
  analyser,
  sourceNode: null,
  mediaRecorder: null,
  recording: null,
  chunks: null,
  pressedKeys: null,
  lastRecordingURL: null,
  lastRecordingBlob: null,
  mouthPosition: 0
};

export default state;
