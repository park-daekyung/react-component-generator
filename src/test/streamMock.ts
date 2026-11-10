// 테스트용: /api/generate의 NDJSON 스트림 응답을 흉내 낸다.
export function ndjsonResponse(events: object[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        controller.close();
      },
    }),
  };
}

export function doneResponse(code: string) {
  return ndjsonResponse([{ type: 'done', code }]);
}
