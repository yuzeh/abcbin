import 'abcjs/abcjs-midi.css';
import 'font-awesome/css/font-awesome.min.css';
import './index.scss';

import React from 'react';
import ReactDOM from 'react-dom';

import abcjs from 'abcjs/midi';
import b64js from 'base64-js';
import request from 'request-promise-native';
import pako from 'pako';

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      timer: '',
      editorState: '',
      renderState: '',
      parseErrors: '',
      shortLink: '',
      shortLinkedRenderState: '',
    };

    this.state.editorState = decompress((window.location.hash || '#').slice(1)) || ABC;
  }

  componentDidMount() {
    let timer = setInterval(() => this.tick(), 1000);
    this.setState({ timer });
  }

  componentWillUnmount() {
    clearInterval(this.state.timer);
  }

  render() {
    const { editorState, renderState, parseErrors } = this.state;
    const { shortLink, shortLinkedRenderState } = this.state;
    return <div>
      <NavBar 
        shortLink={shortLink}
        shortLinkedRenderState={shortLinkedRenderState}
        renderState={renderState}
        onShortLinkClick={() => this.generateShortLink()}
        />
      <div className="container-fluid content">
        <div className="row">
          <div className="col-lg-6 col-md-12">
            <AbcEditor
              onEditorUpdate={(v) => this.editorUpdate(v)}
              editorState={editorState}
              />
          </div>
          <div className="col-lg-6 col-md-12">
            <div className="container-fluid">
              <div className="row">
                <div className="col"><pre>{parseErrors}</pre></div>
              </div>
              <AbcRenderer notation={renderState} />
            </div>
          </div>
        </div>
      </div>
      <footer className='footer'>
        <div className='container'>
        <div className="row">
          <div className="col d-flex justify-content-center">
            <span class='text-muted'>
              &copy; 2018 <a href="https://twitter.com/yuzeh">@yuzeh</a>
              &nbsp;&middot;&nbsp;
              <a href="https://github.com/yuzeh/abcbin">source</a>
              &nbsp;&middot;&nbsp;
              <a href="https://abcjs.net">built on top of abc.js</a>
            </span>
          </div>
        </div>
        </div>
      </footer>
    </div>;
  }

  tick() {
    const { editorState, renderState } = this.state;
    if (editorState === renderState) {
      return;
    }

    let parseErrors = '';
    try {
      abcjs.renderMidi('midi-buffer-hidden', editorState);
    } catch (e) {
      console.error(e);
      if (e.stack) {
        parseErrors = e.stack;
      } else {
        parseErrors = String(e);
      }
    }

    if (parseErrors) {
      this.setState({ parseErrors });
    } else {
      const newHash = `#${compress(editorState)}`;
      if (window.location.hash !== newHash) {
        window.location.hash = newHash;
      }
      this.setState({ renderState: editorState, parseErrors, });
    }
  }

  editorUpdate(editorState) {
    this.setState({ editorState });
  }

  generateShortLink() {
    request({
      method: 'POST',
      uri: '/api.short.cm/links',
      body: {
        domain: 'go.yuzeh.com',
        originalURL: location.href,
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'nqHRiVmKJEQOBgcF',
      },
      json: true,
    }).then(response => {
      const { renderState } = this.state;
      this.setState({
        shortLink: response.shortURL,
        shortLinkedRenderState: renderState,
      });
    }, error => {
      console.error(error);
      this.setState({ shortLinkedRenderState: 'error' });
    })
  }
}

class NavBar extends React.Component {
  render() {
    const { shortLink, shortLinkedRenderState, renderState, onShortLinkClick } = this.props;
    return <nav class="navbar sticky-top navbar-light bg-light">
      <span class="navbar-brand" href="#">
        <strong>abcbin</strong>
        &nbsp;
        <span className='navbar-text'>asynchronous collaborative composition</span>
      </span>
      <ul className="navbar-nav flex-row">
        {shortLinkedRenderState === 'error'
          ? <li className='nav-item mx-2'>An error occurred! Check the console logs.</li>
          : shortLink
          ? <ShortLinkDisplay shortLink={shortLink} isStale={shortLinkedRenderState !== renderState} />
          : null
        }
        <li className='nav-item mx-2'>
          <a
            className='btn btn-outline-primary'
            tabIndex={0}
            onClick={onShortLinkClick}
          >
            Shorten and Share
          </a>
        </li>
        <li className='nav-item mx-2'>
          <a className='nav-link' href='https://www.yuzeh.com'>Home</a>
        </li>
      </ul>
    </nav>;
  }
}

class ShortLinkDisplay extends React.PureComponent {
  render() {
    const { shortLink, isStale } = this.props;
    const input = <input className='form-control' readOnly={true} value={shortLink} />;
    let contents = input;
    if (isStale) {
      contents = <div className='input-group'>
        <div className='input-group-prepend'>
          <div className='input-group-text'>Stale</div>
        </div>
        {input}
      </div>;
    }
    return <li className='nav-item mx-2'>{contents}</li>;
  }
}

class AbcRenderer extends React.Component {
  componentDidMount() {
    this.uniqueId = new Date().toISOString() + Math.random();
  }

  componentWillUnmount() {
    this.lastNotation = null;
  }

  render() {
    const { notation } = this.props;
    if (this.lastNotation !== notation) {
      abcjs.renderAbc(`${this.uniqueId}-engraving`, notation, {responsive: 'resize'});
      abcjs.renderMidi(`${this.uniqueId}-playback`, notation, {
        inlineControls: {
          loopToggle: true,
        }
      });
      this.lastNotation = notation;
    }

    return <div>
      <div className='row'>
        <div className='col'>
          <div id={`${this.uniqueId}-engraving`} />
        </div>
      </div>
      <div className='row'>
        <div className='col'>
          <div className='abcjs-large'>
            <div id={`${this.uniqueId}-playback`} />
          </div>
        </div>
      </div>
    </div>
  }
}

class AbcEditor extends React.Component {
  render() {
    const { onEditorUpdate, editorState } = this.props;
    return <div className='form-group'>
      <label for='editor'>Enter ABC notation here:</label>
      <textarea
        id='editor'
        className='form-control'
        value={editorState}
        rows="20"
        style={{fontFamily: 'monospace'}}
        onChange={(e) => onEditorUpdate(e.target.value)} />
    </div>;
  }
}

const ABC = `X:1\nM: 4/4\nL: 1/8\nK: Emin\n|:D2|EB{c}BA B2 EB|\n`;

const midiBuffer = document.createElement('div');
midiBuffer.id = 'midi-buffer-hidden';
midiBuffer.style.display = 'none';

document.body.appendChild(midiBuffer);
ReactDOM.render(<App />, document.getElementById('app'));

function compress(abcString) {
  const bytes = new TextEncoder('utf-8').encode(abcString);
  const compressed = pako.deflate(bytes);
  return b64js.fromByteArray(compressed);
}

function decompress(hashString) {
  try {
    const bytes = b64js.toByteArray(hashString);
    const decompressed = pako.inflate(bytes);
    return new TextDecoder('utf-8').decode(decompressed);
  } catch (e) {
    console.error('Decompression error', e);
    return '';
  }
}