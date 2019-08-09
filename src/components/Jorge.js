/** @jsx jsx */
import React from "react";
import { jsx } from "@emotion/core";

import globalState from "../state";

import face from "./face.png";
import mouth from "./mouth.png";

export class Jorge extends React.Component {
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
