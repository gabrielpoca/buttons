/** @jsx jsx */
import { jsx } from "@emotion/core";
import React from "react";

export const Key = ({ leftMargin, selected, hasRecording, ...props }) => (
  <div
    css={{
      width: 70,
      height: 70,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid transparent",
      marginLeft: leftMargin ? 10 : 0,
      position: "relative",
      background: selected
        ? "yellow"
        : hasRecording
        ? "rgba(0, 120, 240)"
        : "radial-gradient(60.00px at 50% 50%, #212121 0%, #2B2B2B 100%)",
      boxShadow: selected
        ? null
        : hasRecording
        ? "0px 12px 20px rgba(0, 120, 240, 0.5)"
        : "0px 4px 12px rgba(22, 22, 22, 0.28)"
    }}
    {...props}
  >
    <span css={{ color: selected ? "black" : "white" }}>{props.keycode}</span>
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
