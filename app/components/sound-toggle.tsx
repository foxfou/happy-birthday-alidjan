import { useSyncExternalStore } from "react";

import { mute, sfx } from "~/lib/sfx";

export function SoundToggle() {
  const muted = useSyncExternalStore(mute.subscribe, mute.get, () => false);

  return (
    <button
      className="snd"
      type="button"
      onClick={() => {
        mute.toggle();
        sfx.tick(2);
      }}
    >
      Звук: {muted ? "выкл" : "вкл"}
    </button>
  );
}
