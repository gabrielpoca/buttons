const audioContext = new AudioContext();
const analyser = audioContext.createScriptProcessor(4096, 1, 1);
analyser.connect(audioContext.destination);

const state = {
  audioContext,
  analyser,
  sourceNode: null,
  mediaRecorder: null,
  recording: null,
  chunks: [],
  pressedKeys: {},
  lastRecordingURL: null,
  lastRecordingBlob: null,
  sharingFocused: false,
  mouthPosition: 0
};

export default state;
