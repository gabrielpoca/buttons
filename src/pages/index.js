/** @jsx jsx */

import _ from "lodash";
import React from "react";
import { Global, css, jsx } from "@emotion/core";
import Dexie from "dexie";

import face from "./face.png";
import mouth from "./mouth.png";
import { Key, Row } from "../components/Keyboard";

const db = new Dexie("Button");

db.version(1).stores({
  keys: "key"
});

const FIRST_ROW = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const SECOND_ROW = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const THIRD_ROW = ["z", "x", "c", "v", "b", "n", "m"];
const ALL_KEYS = [...FIRST_ROW, ...SECOND_ROW, ...THIRD_ROW];

const audioContext = new AudioContext();
const analyser = audioContext.createScriptProcessor(4096, 1, 1);
analyser.connect(audioContext.destination);
let sourceNode;
let mediaRecorder;
let recording = false;
let chunks = [];
let globalPressedKeys = {};
let lastRecordingURL;
let lastRecordingBlob;
let mouthPosition = 0;

navigator.mediaDevices
  .getUserMedia({
    audio: true
  })
  .then(stream => {
    mediaRecorder = new MediaRecorder(stream);

    console.log("avm");
    mediaRecorder.ondataavailable = function(e) {
      if (recording) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
      chunks = [];
      lastRecordingBlob = blob;
      lastRecordingURL = window.URL.createObjectURL(blob);
    };
  })
  .catch(err => console.error(err));

class Jorge extends React.Component {
  constructor() {
    super();
    this.ref = React.createRef();

    const update = () => {
      if (this.ref.current)
        this.ref.current.style.transform = `translate(-50%, calc(-50% + ${mouthPosition}px))`;
    };

    analyser.onaudioprocess = e => {
      var int = e.inputBuffer.getChannelData(0);
      var out = e.outputBuffer.getChannelData(0);

      for (var i = 0; i < int.length; i++) {
        out[i] = int[i];

        if (int[i] !== 0) {
          mouthPosition = Math.abs(int[i]) * 100;
          window.requestAnimationFrame(update);
        }
      }
    };
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    return (
      <div css={{ position: "relative", width: 300 }}>
        <img
          css={{
            width: "100%"
          }}
          src={face}
        />
        <img
          ref={this.ref}
          css={{
            position: "absolute",
            width: "100%",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${mouthPosition}px))`,
            transition: "all linear 0.3s",
            zIndex: 9
          }}
          src={mouth}
        />
      </div>
    );
  }
}

class Player extends React.Component {
  constructor() {
    super();

    this.state = {
      pressedKeys: {},
      recordings: {},
      loading: true
    };
  }

  async componentDidMount() {
    window.addEventListener("keydown", this.downHandler);
    window.addEventListener("keyup", this.upHandler);

    try {
      const keys = await db.keys.toArray();

      this.setState({
        recordings: keys.reduce((memo, key) => {
          memo[key.key] = window.URL.createObjectURL(key.blob);
          return memo;
        }, {})
      });
    } catch (e) {
      console.error(e);
    }

    this.setState({ loading: false });
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.downHandler);
    window.removeEventListener("keyup", this.upHandler);
  }

  downHandler = ({ key }) => {
    const lowerKey = _.toLower(key);
    if (!_.includes(ALL_KEYS, lowerKey)) return;
    if (globalPressedKeys[lowerKey]) return;

    const anyPressed = _.reduce(
      globalPressedKeys,
      (memo, value, tKey) => memo || (value && lowerKey !== tKey),
      false
    );

    if (anyPressed) return;

    globalPressedKeys[lowerKey] = true;

    this.setState({
      ...this.state,
      pressedKeys: { ...this.state.pressedKeys, [lowerKey]: true }
    });

    if (lowerKey === key) {
      this.playClip(key);
    } else {
      if (recording) return;
      console.log("recording");
      mediaRecorder.start();
      recording = true;
    }
  };

  upHandler = ({ key }) => {
    const lowerKey = _.toLower(key);
    if (!_.includes(ALL_KEYS, lowerKey)) return;
    if (!globalPressedKeys[lowerKey]) return;

    globalPressedKeys[lowerKey] = false;

    this.setState({
      ...this.state,
      pressedKeys: { ...this.state.pressedKeys, [lowerKey]: false }
    });

    if (!recording) return;

    console.log("saving recording");
    try {
      mediaRecorder.stop();
    } catch (e) {
      console.warn(e);
    }
    setImmediate(() => {
      this.saveClip(lowerKey);
      recording = false;
    });
  };

  loadSound = url => {
    return new Promise(resolve => {
      var request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.responseType = "arraybuffer";

      request.onload = function() {
        resolve(request.response);
      };

      request.send();
    });
  };

  saveClip = async key => {
    if (!lastRecordingURL) return setImmediate(() => this.saveClip(key));

    this.setState({
      recordings: { ...this.state.recordings, [key]: lastRecordingURL }
    });

    lastRecordingURL = null;

    await db.keys.put({
      key,
      blob: lastRecordingBlob
    });
  };

  playClip = async key => {
    const url = this.state.recordings[key];

    if (!url) return;

    try {
      if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect(analyser);
      }
    } catch (e) {
      console.warn(e);
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.connect(analyser);

    const response = await this.loadSound(url);

    audioContext.decodeAudioData(
      response,
      buffer => {
        sourceNode.buffer = buffer;
        sourceNode.loop = false;
        sourceNode.start(0);
      },
      err => console.error(err)
    );
  };

  render() {
    if (this.state.loading) return null;

    return this.props.children(this.state);
  }
}

export default () => {
  return (
    <Player>
      {({ pressedKeys, recordings }) => (
        <div>
          <Global
            styles={css`
              html,
              body {
                background-color: white;
                color: black;
                font-size: 18;
                line-height: 1;
                font-family: Arial;
              }

              body {
                padding: 40px;
              }
            `}
          />
          <div
            css={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              flexDirection: "column"
            }}
          >
            <Row>
              {FIRST_ROW.map((key, index) => (
                <Key
                  selected={pressedKeys[key]}
                  hasRecording={!!recordings[key]}
                  key={key}
                  leftMargin={index !== 0}
                  keycode={key}
                />
              ))}
            </Row>
            <Row css={{ marginLeft: 20, marginTop: 10 }}>
              {SECOND_ROW.map((key, index) => (
                <Key
                  selected={pressedKeys[key]}
                  hasRecording={!!recordings[key]}
                  key={key}
                  leftMargin={index !== 0}
                  keycode={key}
                />
              ))}
            </Row>
            <Row css={{ marginLeft: 50, marginTop: 10 }}>
              {THIRD_ROW.map((key, index) => (
                <Key
                  selected={pressedKeys[key]}
                  key={key}
                  hasRecording={!!recordings[key]}
                  leftMargin={index !== 0}
                  keycode={key}
                />
              ))}
            </Row>
          </div>
          <Jorge />
        </div>
      )}
    </Player>
  );
};
