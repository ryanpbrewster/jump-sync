import React, { useReducer, useState } from "react";
import "./App.css";
import { Map as IMap } from "immutable";
import styled from "styled-components";
import { forEach, groupBy } from "lodash";

const App: React.FC = () => {
  const [state, dispatch] = useReducer(myReducer, EMPTY_STATE);
  return (
    <div className="App">
      <Backend state={state.backend} dispatch={dispatch} />
      <hr />
      <Client state={state.client} dispatch={dispatch} />
    </div>
  );
};

const PUT_ENTRY_REGEX = /^([a-z]+)\/([a-z]+)\s*=\s*([a-z]+)$/;
interface EntryInputProps {
  readonly onSubmit: (action: PutEntry) => void;
}
const EntryInput: React.FC<EntryInputProps> = ({ onSubmit }) => {
  const [value, setValue] = useState("");
  const onKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key === "Enter") {
      const m = PUT_ENTRY_REGEX.exec(value);
      if (m) {
        onSubmit({
          type: "put_entry",
          namespace: m[1],
          key: m[2],
          value: m[3],
        });
        setValue("");
      }
    }
  };
  return (
    <EntryInputWrapper>
      <input
        placeholder="name/key=value"
        onChange={(evt) => setValue(evt.target.value)}
        onKeyDown={onKeyDown}
        value={value}
      ></input>
      <button
        onClick={() =>
          onSubmit({
            type: "put_entry",
            namespace: fruit(),
            key: animal(),
            value: tool(),
          })
        }
      >
        random
      </button>
    </EntryInputWrapper>
  );
};

interface BackendProps {
  readonly state: BackendState;
  readonly dispatch: (action: Action) => void;
}
const Backend: React.FC<BackendProps> = ({ state, dispatch }) => {
  return (
    <BackendWrapper>
      <EntryInput onSubmit={dispatch} />
      <NamespacesWrapper>
        {state.items.entrySeq().sortBy(([name]) => name).map(([name, obj]) => (
          <Namespace key={name} name={name} obj={obj} />
        ))}
      </NamespacesWrapper>
    </BackendWrapper>
  );
};

interface NamespaceProps {
  readonly name: string;
  readonly obj: IMap<string, Entry>;
}
const Namespace: React.FC<NamespaceProps> = ({ name, obj }) => {
  const createdAt = obj.first<null>()!.createdAt;
  return (
    <NamespaceWrapper>
      <NamespaceName lo={createdAt} hi={overallSeqno(obj)} name={name} />
      {obj.entrySeq().map(([key, entry]) => (
        <EntryWrapper key={key}>
          {key} = {entry.value}
          <SeqnoWrapper>{entry.seqno}</SeqnoWrapper>
        </EntryWrapper>
      ))}
    </NamespaceWrapper>
  );
};

interface NamespaceNameProps {
  readonly lo: number;
  readonly hi: number;
  readonly name: string;
}
const NamespaceName: React.FC<NamespaceNameProps> = ({lo, name, hi}) => {
  return <NamespaceNameWrapper>
      <SeqnoWrapper>{lo}</SeqnoWrapper>
      <b>{name}</b>
      <SeqnoWrapper>{hi}</SeqnoWrapper>
  </NamespaceNameWrapper>;
};

interface ClientProps {
  readonly state: ClientState;
  readonly dispatch: (action: Action) => void;
}
const Client: React.FC<ClientProps> = ({ state, dispatch }) => {
  return (
    <ClientWrapper>
      <p>
        [{state.startedSeqno}, {state.nextSeqno})
      </p>
      <button onClick={() => dispatch({ type: "jump" })}>Jump ahead</button>
      <button onClick={() => dispatch({ type: "pull" })}>Pull update</button>
      <button onClick={() => dispatch({ type: "fetch" })}>
        Fetch pending entities
      </button>
      <button onClick={() => dispatch({ type: "apply" })}>
        Apply pending updates
      </button>
      <PendingUpdates
        entries={state.pending}
        items={state.items}
        startedSeqno={state.startedSeqno}
      />
      <NamespacesWrapper>
        {state.items.entrySeq().sortBy(([name]) => name).map(([name, obj]) => (
          <Namespace key={name} name={name} obj={obj} />
        ))}
      </NamespacesWrapper>
    </ClientWrapper>
  );
};

interface PendingUpdatesProps {
  readonly entries: Entry[];
  readonly items: IMap<string, Obj>;
  readonly startedSeqno: number;
}
const PendingUpdates: React.FC<PendingUpdatesProps> = ({
  entries,
  items,
  startedSeqno,
}) => {
  return (
    <PendingUpdateWrapper>
      Pending:
      <ul>
        {entries.map((entry) => {
          const item = items.get(entry.namespace);
          let color;
          if (entry.createdAt >= startedSeqno) {
            color = "green";
          } else if (item) {
            color = overallSeqno(item) < startedSeqno ? "orange" : "green";
          } else {
            color = "red"
          }
          const fqn = `${entry.namespace}/${entry.key}`;
          return (
            <li key={fqn} style={{ color }}>
              {fqn} = <SeqnoWrapper>{entry.createdAt}</SeqnoWrapper>{entry.value}
              <SeqnoWrapper>{entry.seqno}</SeqnoWrapper>
            </li>
          );
        })}
      </ul>
    </PendingUpdateWrapper>
  );
};

interface State {
  readonly backend: BackendState;
  readonly client: ClientState;
}
interface BackendState {
  readonly items: IMap<string, Obj>;
  readonly nextSeqno: number;
}
interface ClientState {
  readonly items: IMap<string, Obj>;
  readonly startedSeqno: number;
  readonly nextSeqno: number;
  readonly pending: Entry[];
}
interface Entry {
  readonly namespace: string;
  readonly key: string;
  readonly value: string;
  readonly seqno: number;
  readonly createdAt: number;
}
type Obj = IMap<string, Entry>;

type Action = PutEntry | JumpAhead | PullEntry | FetchObjects | ApplyUpdates;
interface PutEntry {
  readonly type: "put_entry";
  readonly namespace: string;
  readonly key: string;
  readonly value: string;
}
// Skip ahead in the update stream.
interface JumpAhead {
  readonly type: "jump";
}
// Pull a sync entry with seqno >= bound.
interface PullEntry {
  readonly type: "pull";
}
// Fetch all entities referenced by any of the pending updates.
interface FetchObjects {
  readonly type: "fetch";
}
// Apply all the pending updates.
interface ApplyUpdates {
  readonly type: "apply";
}

const EMPTY_STATE: State = {
  backend: { items: IMap(), nextSeqno: 1 },
  client: { items: IMap(), startedSeqno: 1, nextSeqno: 1, pending: [] },
};
function myReducer(state: State, action: Action): State {
  switch (action.type) {
    case "put_entry": {
      const item = state.backend.items.get(action.namespace) || IMap();
      const entry: Entry = {
        namespace: action.namespace,
        key: action.key,
        value: action.value,
        seqno: state.backend.nextSeqno,
        createdAt: item.first<null>()?.createdAt || state.backend.nextSeqno,
      };
      const updated = state.backend.items.set(
        action.namespace,
        item.set(action.key, entry)
      );
      return {
        ...state,
        backend: { nextSeqno: state.backend.nextSeqno + 1, items: updated },
      };
    }
    case "jump": {
      return {
        ...state,
        client: {
          ...state.client,
          startedSeqno: state.backend.nextSeqno,
          nextSeqno: state.backend.nextSeqno,
          pending: [],
        },
      };
    }
    case "pull": {
      const entries = state.backend.items
        .valueSeq()
        .flatMap((obj) => obj.valueSeq())
        .sortBy((entry) => entry.seqno);
      const item = entries.find(
        (entry) => entry.seqno >= state.client.nextSeqno
      );
      if (!item) return state;
      return {
        ...state,
        client: {
          ...state.client,
          nextSeqno: item.seqno + 1,
          pending: [...state.client.pending, item],
        },
      };
    }
    case "fetch": {
      const names = state.client.pending.map((entry) => entry.namespace);
      const fetched: IMap<string, Obj> = IMap(
        names.map((name) => [name, state.backend.items.get(name) || IMap()])
      );
      return {
        ...state,
        client: { ...state.client, items: state.client.items.merge(fetched) },
      };
    }
    case "apply": {
      const grouped = groupBy(state.client.pending, (entry) => entry.namespace);
      const stuck: Entry[] = [];
      const updated: [string, Obj][] = [];
      forEach(grouped, (updates, name) => {
        const item = state.client.items.get(name);
        const createdAt = updates[0].createdAt;
        if (item && overallSeqno(item) >= state.client.startedSeqno) {
          updated.push([
            name,
            item.merge(updates.map((entry) => [entry.key, entry])),
          ]);
        } else if (createdAt >= state.client.startedSeqno) {
          updated.push([
            name,
            IMap(updates.map((entry) => [entry.key, entry])),
          ]);
        } else {
          stuck.push(...updates);
        }
      });
      return {
        ...state,
        client: {
          ...state.client,
          items: state.client.items.merge(updated),
          pending: stuck,
        },
      };
    }
  }
}

const BackendWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const NamespacesWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const NamespaceWrapper = styled.div`
  display: flex;
  flex-direction: column;
  border: solid 1px black;
  border-radius: 20px;
  margin: 8px;
  padding: 8px;
`;

const SeqnoWrapper = styled.sub`
  color: gray;
`;

const ClientWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const PendingUpdateWrapper = styled.div`
  text-align: left;
  border: dashed 1px gray;
  padding: 4px;
  border-radius: 4px;
`;

const EntryInputWrapper = styled.div`
  display: flex;
  flex-direction: row;
`;

const EntryWrapper = styled.div`
  align-self: flex-start;
`;

const NamespaceNameWrapper = styled.div`
  align-self: center;
  margin-bottom: 8px;
`;

const FRUITS = [
  "apple",
  "orange",
  "kiwi",
  "pineapple",
  "tomato",
  "blueberry",
  "cherry",
  "melon",
];
const ANIMALS = [
  "cat",
  "dog",
  "bear",
  "turtle",
  "zebra",
  "horse",
  "ant",
  "parrot",
];
const TOOLS = [
  "hammer",
  "saw",
  "driver",
  "bit",
  "bolt",
  "screw",
  "nail",
  "chisel",
  "clamp",
  "vise",
];
function fruit(): string {
  return FRUITS[Math.floor(FRUITS.length * Math.random())];
}
function animal(): string {
  return ANIMALS[Math.floor(ANIMALS.length * Math.random())];
}
function tool(): string {
  return TOOLS[Math.floor(TOOLS.length * Math.random())];
}

function overallSeqno(obj: Obj): number {
  return obj.valueSeq().map((entry) => entry.seqno).max()!;
}

export default App;
