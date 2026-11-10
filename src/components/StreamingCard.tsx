import { useEffect, useRef } from 'react';

interface StreamingCardProps {
  prompt: string;
  code: string;
}

// 생성 중인 코드를 실시간으로 보여주는 카드. 완료되면 ComponentCard(미리보기 탭)로 교체된다.
export function StreamingCard({ prompt, code }: StreamingCardProps) {
  const blockRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const block = blockRef.current;
    if (block) block.scrollTop = block.scrollHeight;
  }, [code]);

  return (
    <article className="window component-card component-card--streaming">
      <div className="window-title">
        <h3>생성 중</h3>
      </div>
      <div className="card-header">
        <p className="card-prompt">{prompt}</p>
      </div>
      <div className="card-tabs" role="tablist">
        <button role="tab" aria-selected={false} className="tab" disabled>
          미리보기
        </button>
        <button role="tab" aria-selected={true} className="tab tab--active">
          코드
        </button>
      </div>
      <div className="card-content" role="status" aria-label="코드 생성 중">
        <div className="code-panel">
          <pre className="code-block code-block--streaming" ref={blockRef}>
            <code>{code}</code>
            <span className="cursor" aria-hidden="true" />
          </pre>
        </div>
      </div>
    </article>
  );
}
