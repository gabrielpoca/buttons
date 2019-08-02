/** @jsx jsx */

import _ from "lodash";
import React from "react";
import { Global, css, jsx } from "@emotion/core";

import face from "./face.png";
import mouth from "./mouth.png";
import { Key, Row } from "../components/Keys";
import globalState from "../state";
import db from "../db";
import { share, download } from "../ipfs";

const FIRST_ROW = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const SECOND_ROW = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const THIRD_ROW = ["z", "x", "c", "v", "b", "n", "m"];
const ALL_KEYS = [...FIRST_ROW, ...SECOND_ROW, ...THIRD_ROW];

window.navigator.mediaDevices
  .getUserMedia({
    audio: true
  })
  .then(stream => {
    globalState.mediaRecorder = new MediaRecorder(stream);

    globalState.mediaRecorder.ondataavailable = function(e) {
      if (globalState.recording) {
        globalState.chunks.push(e.data);
      }
    };

    globalState.mediaRecorder.onstop = () => {
      const blob = new Blob(globalState.chunks, {
        type: "audio/ogg; codecs=opus"
      });
      globalState.chunks = [];
      globalState.lastRecordingBlob = blob;
      globalState.lastRecordingURL = window.URL.createObjectURL(blob);
    };
  })
  .catch(err => console.error(err));

class Jorge extends React.Component {
  constructor() {
    super();
    this.ref = React.createRef();

    const update = () => {
      if (this.ref.current)
        this.ref.current.style.transform = `translate(-50%, calc(-50% + ${globalState.mouthPosition}px))`;
    };

    globalState.analyser.onaudioprocess = e => {
      var int = e.inputBuffer.getChannelData(0);
      var out = e.outputBuffer.getChannelData(0);

      for (var i = 0; i < int.length; i++) {
        out[i] = int[i];

        if (int[i] !== 0) {
          globalState.mouthPosition = Math.abs(int[i]) * 100;
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
            transform: `translate(-50%, calc(-50% + ${globalState.mouthPosition}px))`,
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
      recording: false,
      recordings: {},
      loading: true
    };
  }

  async componentDidMount() {
    window.addEventListener("keydown", this.downHandler);
    window.addEventListener("keyup", this.upHandler);

    try {
      const keys = await db.keys.toArray();

      console.log(keys);

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
    if (globalState.pressedKeys[lowerKey]) return;

    const anyPressed = _.reduce(
      globalState.pressedKeys,
      (memo, value, tKey) => memo || (value && lowerKey !== tKey),
      false
    );

    if (anyPressed) return;

    globalState.pressedKeys[lowerKey] = true;

    this.setState({
      ...this.state,
      recording: { ...this.state.recording },
      pressedKeys: { ...this.state.pressedKeys, [lowerKey]: true }
    });

    if (lowerKey === key) {
      this.playClip(key);
    } else {
      if (globalState.recording) return;
      console.log("recording");
      globalState.mediaRecorder.start();
      globalState.recording = true;
    }
  };

  upHandler = ({ key }) => {
    const lowerKey = _.toLower(key);
    if (!_.includes(ALL_KEYS, lowerKey)) return;
    if (!globalState.pressedKeys[lowerKey]) return;

    globalState.pressedKeys[lowerKey] = false;

    this.setState({
      ...this.state,
      recording: { ...this.state.recording },
      pressedKeys: { ...this.state.pressedKeys, [lowerKey]: false }
    });

    if (!globalState.recording) return;

    console.log("saving recording");
    try {
      globalState.mediaRecorder.stop();
    } catch (e) {
      console.warn(e);
    }
    setImmediate(() => {
      this.saveClip(lowerKey);
      globalState.recording = false;
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
    if (!globalState.lastRecordingURL)
      return setImmediate(() => this.saveClip(key));

    this.setState({
      recordings: {
        ...this.state.recordings,
        [key]: globalState.lastRecordingURL
      }
    });

    globalState.lastRecordingURL = null;

    await db.keys.put({
      key,
      blob: globalState.lastRecordingBlob
    });
  };

  playClip = async key => {
    const url = this.state.recordings[key];

    if (!url) return;

    try {
      if (globalState.sourceNode) {
        globalState.sourceNode.stop();
        globalState.sourceNode.disconnect(globalState.analyser);
      }
    } catch (e) {
      console.warn(e);
    }

    globalState.sourceNode = globalState.audioContext.createBufferSource();
    globalState.sourceNode.connect(globalState.analyser);

    const response = await this.loadSound(url);

    globalState.audioContext.decodeAudioData(
      response,
      buffer => {
        globalState.sourceNode.buffer = buffer;
        globalState.sourceNode.loop = false;
        globalState.sourceNode.start(0);
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
      {({ pressedKeys, recording, recordings }) => (
        <div>
          <Global
            styles={css`
              html,
              body {
                background-color: white;
                color: #1b1b1b;
                font-size: 18;
                line-height: 1;
                font-family: Arial;
              }

              body {
                padding: 40px;
              }
            `}
          />
          <h1>Push to Talk</h1>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              css={{
                padding: 40,
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
                    isRecording={recording}
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
                    isRecording={recording}
                    key={key}
                    leftMargin={index !== 0}
                    keycode={key}
                  />
                ))}
              </Row>
              <Row
                css={{ marginLeft: 50, marginTop: 10, position: "relative" }}
              >
                {THIRD_ROW.map((key, index) => (
                  <Key
                    selected={pressedKeys[key]}
                    key={key}
                    hasRecording={!!recordings[key]}
                    isRecording={recording}
                    leftMargin={index !== 0}
                    keycode={key}
                  />
                ))}
                <Key
                  css={{
                    width: 100,
                    position: "absolute",
                    left: "0",
                    transform: "translateX(calc(-100% - 10px))"
                  }}
                  selected={false}
                  hasRecording={false}
                  isRecording={false}
                  keycode="Shift"
                />
              </Row>
            </div>
          </div>
          <Jorge />
          <button
            onClick={() =>
              share().then(hash => alert(`Share this link ${hash}`))
            }
          >
            Share
          </button>
          <button
            onClick={() => {
              const hash = prompt("PAST YOUR HASH");
              download(hash);
            }}
          >
            Download
          </button>
        </div>
      )}
    </Player>
  );
};
