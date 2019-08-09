import React, { useState } from "react";

export function KeyboardNameInput(props) {
  const [name, setName] = useState("");

  return (
    <>
      <input
        placeholder="Your keyboard's name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <button disabled={!name} onClick={() => props.onComplete(name)}>
        Share keyboard
      </button>
    </>
  );
}
