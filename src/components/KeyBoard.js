/** @jsx jsx */
import { jsx } from "@emotion/core";
import React from "react";

export const Key = ({ leftMargin, selected, hasRecording, ...props }) => (
  <div
    css={{
      width: 70,
      height: 70,
      borderRadius: 4,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid white",
      borderColor: hasRecording ? "red" : "black",
      marginLeft: leftMargin ? 10 : 0,
      position: "relative",
      background: selected ? "yellow" : "transparent"
    }}
    {...props}
  >
    <span css={{}}>{props.keycode}</span>
  </div>
);

export const Row = props => (
  <div
    css={{
      display: "flex"
    }}
    {...props}
  >
    {props.children}
  </div>
);
