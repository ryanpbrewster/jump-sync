import React, { useCallback, useReducer, useState } from 'react';
import './App.css';
import {Map as IMap} from 'immutable';
import styled from 'styled-components';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(myReducer, EMPTY_STATE);
  return (
    <div className="App">
      <Backend state={state} />
      <Client state={state} />
      <EntryInput onSubmit={dispatch} />
    </div>
  );
};

const PUT_ENTRY_REGEX = /(^[a-z]+)\/([a-z]+)\s*=\s*([a-z]+)$/;
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
  readonly state: State;
}
const Backend: React.FC<BackendProps> = ({state}) => {
  return <BackendWrapper>
    {state.backend.entrySeq().map(([name, obj]) => <Namespace key={name} name={name} obj={obj} />)}
  </BackendWrapper>
};

interface NamespaceProps {
  readonly name: string;
  readonly obj: IMap<string, Entry>;
}
const Namespace: React.FC<NamespaceProps> = ({name, obj}) => {
  return <NamespaceWrapper>
    <b>{name}</b>
    {obj.entrySeq().map(([key, entry]) => <p key={key}>{key} = {entry.value}/{entry.seqno}</p>)}
  </NamespaceWrapper>
};

interface ClientProps {
  readonly state: State;
}
const Client: React.FC<ClientProps> = ({state}) => {
  return <p>Client</p>;
};

interface State {
  readonly backend: IMap<string, IMap<string, Entry>>;
  readonly nextSeqno: number;
}
interface Entry {
  readonly namespace: string;
  readonly key: string;
  readonly value: string;
  readonly seqno: number;
}
type Action = PutEntry;
interface PutEntry {
  readonly type: 'put_entry';
  readonly namespace: string;
  readonly key: string;
  readonly value: string;
}

const EMPTY_STATE: State = {backend: IMap(), nextSeqno: 1};
function myReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'put_entry': {
      const entry: Entry = { namespace: action.namespace, key: action.key, value: action.value, seqno: state.nextSeqno };
      const named = state.backend.get(action.namespace) || IMap();
      const updated = state.backend.set(action.namespace, named.set(action.key, entry));
      return {...state, nextSeqno: state.nextSeqno + 1, backend: updated};
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

export default App;