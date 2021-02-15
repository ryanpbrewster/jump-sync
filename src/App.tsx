import React, { useCallback, useReducer, useState } from 'react';
import './App.css';
import {Map as IMap} from 'immutable';
import styled from 'styled-components';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(myReducer, EMPTY_STATE);
  const putEntry = useCallback((raw: string) => {
    const [k, value] = raw.split('=');
    const [namespace, key] = k.split('/');
    dispatch({type: 'put_entry', namespace, key, value});
  }, [dispatch]);
  return (
    <div className="App">
      <Backend state={state} />
      <Client state={state} />
      <EntryInput onSubmit={putEntry} />
    </div>
  );
};

interface EntryInputProps {
  readonly onSubmit: (raw: string) => void;
}
const EntryInput: React.FC<EntryInputProps> = ({onSubmit}) => {
  const [value, setValue] = useState('');
  return <input
    placeholder="name/key=value"
    onChange={(evt) => setValue(evt.target.value)}
    onKeyDown={(evt: React.KeyboardEvent) => evt.key === 'Enter' && onSubmit(value)}>
    </input>
};

interface BackendProps {
  readonly state: State;
}
const Backend: React.FC<BackendProps> = ({state}) => {
  return <BackendWrapper>
    {state.backend.entrySeq().map(([name, obj]) => name)}
  </BackendWrapper>
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
`;

export default App;