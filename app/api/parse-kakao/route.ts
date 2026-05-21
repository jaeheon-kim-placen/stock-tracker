import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  const lines = text.split(/\r?\n/)
  let currentDate = ''
  const sionMessages: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const dateMatch = line.match(/[-]+\s*(\d{4}년 \d{1,2}월 \d{1,2}일)/)
    if (dateMatch) {
      currentDate = dateMatch[1]
      continue
    }

    const msgMatch = line.match(/\[이시온\]\s*\[(오전|오후)\s*(\d{1,2}:\d{2})\]\s*(.*)/)
    if (msgMatch) {
      const ampm = msgMatch[2]
      const time = msgMatch[3]
      let message = (msgMatch[4] || '').trim()

      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        if (nextLine.match(/^\[/) || nextLine.match(/[-]+\s*\d{4}년/)) break
        message += ' ' + nextLine.trim()
        i++
      }

      if (message) {
        sionMessages.push(`${currentDate} ${ampm} ${time} | ${message}`)
      }
    }
  }

  if (sionMessages.length === 0) {
    return NextResponse.json({ orders: [], error: '이시온 메시지를 찾을 수 없습니다.' })
  }

  const filteredText = sionMessages.join('\n')

  const prompt = `아래는 이시온이 보낸 카카오톡 메시지 목록입니다.
형식: 날짜 오전/오후 시:분 | 메시지 내용

주식 매수/매도 지시를 찾아서 JSON 배열로 반환해주세요.

[매수 키워드]
"사자", "매수", "사야겠다", "추가매수", "BUY", "사보자", "사볼게", "매수할게", "사겠다", "넣자", "걸어놓자" → action: "BUY"

[매도 키워드]
"팔자", "매도", "팔아야", "SELL", "전량매도", "팔고", "팔아", "매도하자", "팔기" → action: "SELL"

[종목 인식 규칙]
1. 영문 티커는 대소문자 무관하게 인식 (soxl=SOXL, koru=KORU, fngu=FNGU 등)
2. 한글+영문 붙여쓴 경우도 인식 (예: "tmc더메틸스컴퍼니" → stock_code: "TMC", stock_name: "The Metals Company")
3. 자주 등장하는 종목 매핑:
   - soxl → SOXL (Direxion Daily Semiconductor Bull 3X)
   - bulz → BULZ (Direxion Daily US Market Bull 3X)
   - koru → KORU (Direxion Daily South Korea Bull 3X)
   - fngu → FNGU (MicroSectors FANG+ 3X)
   - usd → USDU (WisdomTree Bloomberg US Dollar)
   - tmc → TMC (The Metals Company)
   - tlt → TLT (iShares 20+ Year Treasury Bond ETF)
   - nvdl → NVDL (GraniteShares 2x Long NVDA)
   - agix → AGIX
   - iren → IREN (IREN Ltd)
   - smh → SMH (VanEck Semiconductor ETF)
   - intc → INTC (Intel)
   - pltr → PLTR (Palantir)
   - 메타 → META
   - 아마존 → AMZN
   - 알파벳/구글 → GOOGL
   - 애플 → AAPL
   - 마소/마이크로소프트 → MSFT
   - 인텔 → INTC
   - 팔란티어 → PLTR
   - 브로드컴 → AVGO
   - 카메코 → CCJ
   - 서던코퍼 → SCCO
   - 프리포트맥모란 → FCX
   - 아이온큐 → IONQ
   - 이노데이터 → INOD
   - 코인베이스 → COIN
   - 테슬라 → TSLA
   - 오클로 → OKLO
   - 센트러스 → LEU
   - 뉴스케일 → SMR
   - 마린엔진/현대마린엔진 → HD현대마린엔진
   - 에이프릴바이오 → 에이프릴바이오
   - 네이버 → NAVER
   - 카카오 → 카카오
   - oracle → ORCL
   - coreweave → CRWV
   - lite → LITE (Lumentum)
   - 상신이디피 → 상신이디피
   - magx/마그넘x → MAGX

[market 규칙] ← 중요
- market은 반드시 "NASDAQ", "NYSE", "KRX" 중 하나만 사용
- 한국 주식 (삼성전자, 카카오, 네이버, 에이프릴바이오, 상신이디피, 현대마린엔진 등) → "KRX"
- 미국 주식 ETF 및 개별주 (SOXL, BULZ, KORU, FNGU, META, AMZN, TSLA 등) → "NASDAQ"
- NYSE 상장 종목 (SCCO, FCX, CCJ 등 원자재/광업주) → "NYSE"
- 모르면 "NASDAQ" 사용

[수량/금액 인식 규칙]
- "전량", "전부", "다" → quantity: "전량"
- "절반", "반반" → quantity: "절반"
- "1/4씩" → quantity: "1/4"
- "1/3씩" → quantity: "1/3"
- "천만원", "1천만원", "1천" → quantity: "1천만원"
- "500만원", "500" → quantity: "500만원"
- "X주" → quantity: "X주"
- "X프로", "X%" → quantity: "X%"

[다중 종목 처리]
- 한 메시지에 여러 종목이 나열되면 각각 별도 오더로 분리
- 예) "soxl bulz koru 1/4씩 매도" → SOXL SELL 1/4, BULZ SELL 1/4, KORU SELL 1/4
- 예) "Soxl fngu bulz usd tmc더메틸스컴퍼니 전량 매도" → 5개 종목 각각 SELL 전량
- 나열된 종목 뒤에 오는 액션/수량은 모든 종목에 적용

[맥락 처리]
- "나머지 종목들도" 같은 표현은 해당 메시지에서 파악 가능한 종목만 처리
- "판 돈으로", "그 돈으로" 같은 표현은 quantity: "판 돈으로" 로 기록
- 직전 메시지를 취소/수정하는 경우 (예: "아 아니다", "취소") 해당 오더 제외

[제외 항목]
- 부동산, 암호화폐 관련 내용
- 주식과 무관한 일상 대화
- "~할 것 같다", "~어떻게 생각해?" 등 지시가 아닌 의견/질문

[날짜/시간 변환]
- 오전 9:30 → T09:30:00
- 오후 2:30 → T14:30:00
- 오후 12:00 → T12:00:00
- 오전 12:00 → T00:00:00

반드시 JSON 배열 형식으로만 응답. 설명 텍스트 절대 금지:
[{"person_name":"이시온","stock_code":"티커","stock_name":"종목명","market":"NASDAQ","action":"BUY","price_at_order":null,"quantity":"수량또는null","messaged_at":"2026-05-20T14:30:00","message_original":"원문"}]

이시온 메시지:
${filteredText}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 65536 }
      })
    }
  )

  const data = await response.json()

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error('Gemini API error:', JSON.stringify(data))
    return NextResponse.json({ orders: [], error: 'API error: ' + JSON.stringify(data) })
  }

  const content = data.candidates[0].content.parts[0].text

  try {
    let clean = content.replace(/```json|```/g, '').trim()
    const lastBrace = clean.lastIndexOf('}')
    if (lastBrace !== -1 && !clean.endsWith(']')) {
      clean = clean.substring(0, lastBrace + 1) + ']'
    }
    const orders = JSON.parse(clean)
    // market 값 보정 (혹시 모를 잘못된 값 방지)
    const sanitized = orders.map((o: any) => ({
      ...o,
      market: ['NASDAQ', 'NYSE', 'KRX'].includes(o.market) ? o.market : 'NASDAQ'
    }))
    return NextResponse.json({ orders: sanitized, total_messages: sionMessages.length })
  } catch (e) {
    console.error('parse failed, raw content:', content)
    return NextResponse.json({ orders: [], error: 'parse failed', raw: content })
  }
}