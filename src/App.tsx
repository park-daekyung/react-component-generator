import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Provider } from './types';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

const MAX_HISTORY = 10;

const parseString = (raw: unknown) => (typeof raw === 'string' ? raw : null);
const parseProvider = (raw: unknown) =>
  typeof raw === 'string' && raw in PROVIDER_CONFIG ? (raw as Provider) : null;
const parseHistory = (raw: unknown) =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : null;

function App() {
  const [apiKey, setApiKey] = useLocalStorage('rcg:apiKey', '', parseString);
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useLocalStorage<Provider>('rcg:provider', 'google', parseProvider);
  const [history, setHistory] = useLocalStorage<string[]>('rcg:promptHistory', [], parseHistory);
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const { components, isLoading, error, generate, removeComponent, clearAll } =
    useComponentGenerator();

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      alert(`${PROVIDER_CONFIG[provider].label} API 키를 입력하거나 .env에 설정해주세요.`);
      return;
    }
    setHistory((prev) => [prompt, ...prev.filter((p) => p !== prompt)].slice(0, MAX_HISTORY));
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setApiKey('');
  };

  const activeProvider = PROVIDER_CONFIG[provider].label;

  return (
    <div className="app">
      <header className="menubar">
        <div className="menubar-brand">
          <span className="brand-mark" aria-hidden="true">RC</span>
          <span>컴포넌트 생성기</span>
        </div>
        <div className="menubar-status" aria-label="현재 작업 상태">
          <span>제공자 {activeProvider}</span>
          <span>컴포넌트 {components.length}개</span>
        </div>
      </header>

      <div className="hero">
        <h1>프롬프트로 만드는 UI 워크벤치</h1>
        <p>만들고 싶은 화면을 말로 설명하세요. React 컴포넌트가 바로 미리보기와 코드로 나옵니다.</p>
      </div>

      <main className="workspace">
        <section className="window composer-panel" aria-labelledby="composer-title">
          <div className="window-title">
            <h2 id="composer-title">무엇을 만들까요?</h2>
          </div>
          <div className="window-body">
            <PromptInput onGenerate={handleGenerate} isLoading={isLoading} history={history} />
          </div>
        </section>

        <aside className="window settings-panel" aria-labelledby="settings-title">
          <div className="window-title">
            <h2 id="settings-title">실행 설정</h2>
          </div>
          <div className="window-body">
          <div className="provider-select">
            <label htmlFor="provider">AI 제공자</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
            >
              {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="api-key-input">
            <label htmlFor="api-key">
              API Key
            </label>
            <div className="api-key-field">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  hasEnvKey
                    ? '서버 키 사용 중 (직접 입력으로 덮어쓰기 가능)'
                    : PROVIDER_CONFIG[provider].placeholder
                }
              />
              <button
                className="btn-toggle-key"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
              {hasEnvKey ? '.env 키가 연결되어 있습니다.' : '직접 입력하거나 서버 환경변수를 설정하세요.'}
            </p>
          </div>
          </div>
        </aside>
      </main>

      {error && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
        </div>
      )}

      <section className="results-section" aria-label="생성된 컴포넌트">
        {components.length > 0 && (
          <div className="results-header">
            <h2>생성된 컴포넌트</h2>
            <button className="btn-clear" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        {components.length === 0 && !isLoading && (
          <div className="window empty-state">
            <div className="window-title">
              <h2>빈 작업대</h2>
            </div>
            <div className="empty-body">
              <div className="empty-preview" aria-hidden="true">
                <div className="empty-canvas">
                  <div className="empty-card empty-card--primary" />
                  <div className="empty-card" />
                  <div className="empty-card empty-card--wide" />
                </div>
              </div>
              <div className="empty-copy">
                <p className="empty-heading">
                  아직 만든 컴포넌트가 없어요
                  <span className="cursor" aria-hidden="true" />
                </p>
                <p>위 입력창에 화면을 설명하거나 예시를 골라 컴포넌트 생성을 누르세요.</p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="window loading-card" role="status">
            <div className="window-title">
              <h2>생성 중</h2>
            </div>
            <div className="loading-body">
              <p>컴포넌트를 생성하고 있습니다...</p>
              <div className="progress" aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="results-grid">
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              isLoading={isLoading}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
