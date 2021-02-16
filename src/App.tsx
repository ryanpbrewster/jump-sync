import React, { useCallback, useReducer, useState } from 'react';
import './App.css';
import {Map as IMap} from 'immutable';
import styled from 'styled-components';
import { isExpressionWithTypeArguments } from 'typescript';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(myReducer, EMPTY_STATE);
  return (
    <div className="App">
      <Backend state={state.backend} dispatch={dispatch} />
      <EntryInput onSubmit={dispatch} />
      <hr />
      <Client state={state.client} dispatch={dispatch} />
    </div>
  );
};

const PUT_ENTRY_REGEX = /^([a-z]+)\/([a-z]+)\s*=\s*([a-z]+)$/;
interface EntryInputProps {
  readonly onSubmit: (action: PutEntry) => void;
}
const EntryInput: React.FC<EntryInputProps> = ({onSubmit}) => {
  const [value, setValue] = useState('');
  const onKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key === 'Enter') {
      const m = PUT_ENTRY_REGEX.exec(value);
      if (m) {
        onSubmit({type: 'put_entry', namespace: m[1], key: m[2], value: m[3]});
        setValue('');
      }
    }
  }
  return <input
    placeholder="name/key=value"
    onChange={(evt) => setValue(evt.target.value)}
    onKeyDown={onKeyDown}
    value={value}></input>
};

interface BackendProps {
  readonly state: BackendState;
  readonly dispatch: (action: Action) => void;
}
const Backend: React.FC<BackendProps> = ({state}) => {
  return <BackendWrapper>
    {state.items.entrySeq().map(([name, obj]) => <Namespace key={name} name={name} obj={obj} />)}
  </BackendWrapper>
};

interface NamespaceProps {
  readonly name: string;
  readonly obj: IMap<string, Entry>;
}
const Namespace: React.FC<NamespaceProps> = ({name, obj}) => {
  return <NamespaceWrapper>
    <b>{name}</b>
    {obj.entrySeq().map(([key, entry]) => <p key={key}>{key} = {entry.value}<SeqnoWrapper>{entry.seqno}</SeqnoWrapper></p>)}
  </NamespaceWrapper>
};

interface ClientProps {
  readonly state: ClientState;
  readonly dispatch: (action: Action) => void;
}
const Client: React.FC<ClientProps> = ({state, dispatch}) => {
  return <ClientWrapper>
    <p>[{state.startedSeqno}, {state.nextSeqno})</p>
    <button onClick={() => dispatch({type: 'jump'})}>Jump ahead</button>
    <button disabled={!!state.pending} onClick={() => dispatch({type: 'pull'})}>Pull update</button>
    <PendingUpdate entry={state.pending} />
  </ClientWrapper>;
};

interface PendingUpdateProps {
  readonly entry: Entry | null;
}
const PendingUpdate: React.FC<PendingUpdateProps> = ({entry}) => {
  return <PendingUpdateWrapper>
    {entry && `${entry.namespace}/${entry.key} = ${entry.value}`}
  </PendingUpdateWrapper>
}

interface State {
  readonly backend: BackendState;
  readonly client: ClientState;
}
interface BackendState {
  readonly items: IMap<string, IMap<string, Entry>>;
  readonly nextSeqno: number;
}
interface ClientState {
  readonly items: IMap<string, IMap<string, Entry>>;
  readonly startedSeqno: number;
  readonly nextSeqno: number;
  readonly pending: Entry | null;
}
interface Entry {
  readonly namespace: string;
  readonly key: string;
  readonly value: string;
  readonly seqno: number;
}
type Action = PutEntry | JumpAhead | PullEntry;
interface PutEntry {
  readonly type: 'put_entry';
  readonly namespace: string;
  readonly key: string;
  readonly value: string;
}
// Skip ahead in the update stream.
interface JumpAhead {
  readonly type: 'jump';
}
// Pull a sync entry with seqno >= bound.
interface PullEntry {
  readonly type: 'pull';
}

const EMPTY_STATE: State = {
  backend: {items: IMap(), nextSeqno: 1},
  client: {items: IMap(), startedSeqno: 1, nextSeqno: 1, pending: null},
};
function myReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'put_entry': {
      const entry: Entry = { namespace: action.namespace, key: action.key, value: action.value, seqno: state.backend.nextSeqno };
      const named = state.backend.items.get(action.namespace) || IMap();
      const updated = state.backend.items.set(action.namespace, named.set(action.key, entry));
      return {
        ...state,
        backend: {nextSeqno: state.backend.nextSeqno + 1, items: updated},
      };
    }
    case 'jump': {
      return {
        ...state,
        client: {...state.client, startedSeqno: state.backend.nextSeqno, nextSeqno: state.backend.nextSeqno, pending: null},
      }
    }
    case 'pull': {
      const entries = state.backend.items.valueSeq().flatMap((obj) => obj.valueSeq()).sortBy((entry) => entry.seqno);
      const item = entries.find((entry) => entry.seqno >= state.client.nextSeqno);
      if (!item) return state;
      return {
        ...state,
        client: {...state.client, nextSeqno: item.seqno+1, pending: item},
      }
    }
  }
}

const BackendWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const NamespaceWrapper = styled.div`
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
  border: dashed 1px gray;
  padding: 4px;
  border-radius: 4px;
`;

export default App;