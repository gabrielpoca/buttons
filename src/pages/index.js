/** @jsx jsx */

import _ from "lodash";
import React, { useState, useEffect } from "react";
import { Global, css, jsx } from "@emotion/core";
import Popup from "reactjs-popup";

import { Key, Row } from "../components/Keys";
import { Jorge } from "../components/Jorge";
import { KeyboardNameInput } from "../components/KeyboardNameInput";
import globalState from "../state";
import db from "../db";
import { share, download } from "../ipfs";

const FIRST_ROW = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const SECOND_ROW = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const THIRD_ROW = ["z", "x", "c", "v", "b", "n", "m"];
const ALL_KEYS = [...FIRST_ROW, ...SECOND_ROW, ...THIRD_ROW];

const hashInQueryParams = querystring("hash")[0];

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

function querystring(obj) {
  const result = [];
  let match;
  const re = new RegExp("(?:\\?|&)" + obj + "=(.*?)(?=&|$)", "gi");
  while ((match = re.exec(document.location.search)) !== null) {
    result.push(match[1]);
  }
  return result;
}

function Share() {
  const [state, setState] = useState({ hash: null, name: null });

  useEffect(() => {
    if (state.name && state.hash) {
      db.keyboards.put(state);
    }
  }, [state]);

  return (
    <Popup
      trigger={
        <button
          css={{
            backgroundColor: "#2D2D2D",
            color: "white",
            fontSize: 20,
            padding: `10px 20px`,
            marginRight: 40,
            borderRadius: 4
          }}
        >
          Save and Share
        </button>
      }
      modal
      position="right center"
      onOpen={() => {
        globalState.sharingFocused = true;

        share().then(async hash => {
          await db.keyboards.put({ hash, name: "my random name" });
          setState({ ...state, hash });
        });
      }}
      onClose={() => {
        globalState.sharingFocused = false;
        setState({ hash: null, name: null });
      }}
      contentStyle={{ padding: 40, borderRadius: 4 }}
    >
      <>
        {!state.name ? (
          <KeyboardNameInput
            onComplete={name => setState({ ...state, name })}
          />
        ) : !state.hash ? (
          <div>loading...</div>
        ) : (
          <div>
            Share this link:{" "}
            <a
              href={`${window.location}?hash=${state.hash}`}
            >{`${window.location}?hash=${state.hash}`}</a>
          </div>
        )}
      </>
    </Popup>
  );
}

function Download() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    await download(hashInQueryParams);
    window.location = window.location.origin;
  };

  return hashInQueryParams ? (
    <Popup contentStyle={{ padding: 40 }} modal open>
      {loading ? (
        <div>loading...</div>
      ) : (
        <>
          <div css={{ marginBottom: 20 }}>
            Do you want to replace your existing keyboard with the new one?
          </div>
          <button onClick={handleDownload} css={{ marginRight: 20 }}>
            Yes!
          </button>
          <button
            onClick={() => {
              window.location = window.location.origin;
            }}
          >
            No
          </button>
        </>
      )}
    </Popup>
  ) : null;
}

function Keyboards() {
  const [keyboards, setKeyboards] = useState([]);

  const load = async () => {
    const keyboards = await db.keyboards.toArray();
    setKeyboards(keyboards);
  };

  return (
    <Popup
      trigger={
        <button
          css={{
            backgroundColor: "#2D2D2D",
            color: "white",
            fontSize: 20,
            padding: `10px 20px`,
            marginRight: 40,
            borderRadius: 4
          }}
        >
          Your keyboards
        </button>
      }
      onOpen={load}
      contentStyle={{ padding: 40 }}
      modal
    >
      <div>
        {keyboards.length > 0 ? (
          <>
            <h4>Your keyboards:</h4>
            <ul>
              {keyboards.map(({ hash, name }) => (
                <li key={hash}>
                  <a href={`${window.location}?hash=${hash}`}>{name}</a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Popup>
  );
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
    if (globalState.sharingFocused) return;

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
    if (globalState.sharingFocused) return;

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
          <Download />
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
          <Share />
          <Keyboards />
        </div>
      )}
    </Player>
  );
};
