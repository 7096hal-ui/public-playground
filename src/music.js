// 배경음악: 파일 없이 Web Audio로 직접 연주하는 칩튠. 모든 곡은 이 게임을 위해 새로 지었다.
//
// 흐름: 악보(TRACKS) → compile()로 한 바퀴 분량의 음표 목록을 만든다
//       → 스케줄러가 0.15초 앞까지 조금씩 예약 → 음표마다 잠깐 쓰고 버리는 오실레이터
//       → 성부 버스 → 곡 버스(페이드용) → musicBus
import { onAudioReady, audioGraph } from './audio.js';

// ── 악보 적는 법 ──────────────────────────────────────────────────────────────
// 곡 = { bpm, key, swing?, mix?, form, inst, (성부·드럼 기본 패턴), sections }  — 언제나 4/4박자
//   swing    16분음표 뒷박을 늦추는 정도(0~0.5).   mix  드럼 음량 { k, s, h, c } (기본값은 DRUM_VOL)
//   form     구간 순서. 'A1 A2 B A2' — 끝까지 돌면 처음으로 이어진다.
//   sections 구간마다 chords(마디별 화음)와, 기본 패턴을 바꿀 성부·드럼 패턴. '' 은 그 구간에서 쉼.
//   마디 구분은 '|'. 한 마디는 적힌 칸 수만큼 똑같이 나뉜다(4칸=4분음표, 8칸=8분, 16칸=16분).
//   패턴이 구간보다 짧으면 되풀이된다.
// 화음  'C | Am | F G | C' — 한 마디에 둘이면 반 마디씩. (C, Cm, C7, Cmaj7, Cm7, Cdim, Csus4 …)
// 선율 성부(inst에 있는 이름) — 칸은 띄어쓰기로 나눈다.
//   C5 F#4 Bb3  음 이름     .  쉼     -  앞 음 늘이기(마디를 넘어도 된다)
//   1 3 5 7 8 9 지금 화음의 근음·3음·5음·7음(없으면 옥타브)·옥타브·9음. 근음은 inst.base 바로 위.
//   358         여러 음을 한꺼번에(화음). 숫자 뒤 ' 는 한 옥타브 위, , 는 아래.
// 드럼(k 킥, s 스네어, h 하이햇, c 심벌) — 한 글자가 한 칸. x 보통, X 세게, g 여리게, o 열린 하이햇.
// inst 항목: wave(square·triangle·sawtooth·sine·pulse25·pulse12), vol(오실레이터 하나의 음량),
//   base(화음 성부 근음의 가장 낮은 자리), gate(칸 길이 중 실제로 울리는 비율),
//   a·d·s·r(어택·감쇠 시간상수·지속 비율·릴리스), vib(비브라토 cent), bend(음 첫머리 꺾기 cent),
//   lp(저역 통과 Hz), copy·shift·tr(다른 성부를 shift박 늦게, tr반음 옮겨 따라 친다 — 메아리·겹치기)
export const TRACKS = {
  // 타이틀: 밝고 통통 튀는 "꿀꿀!" 후렴. 같은 음 두 번 → 훌쩍 뛰어오르기
  title: {
    bpm: 132,
    key: 'C major',
    form: 'A1 A2 B A2',
    inst: {
      lead: { wave: 'pulse25', vol: 0.075, vib: 12, gate: 0.85 },
      bass: { wave: 'triangle', vol: 0.12, base: 'E2', gate: 0.7 },
      chord: { wave: 'pulse12', vol: 0.045, base: 'G3', gate: 0.35, s: 0.4, d: 0.06 },
    },
    bass: '1 . 8 . 5 . 8 .',
    chord: '. 358 . 358 . 358 . 358',
    k: 'x.....x.x.......',
    s: '....x.......x...',
    h: 'x.x.x.x.x.x.x.o.',
    sections: {
      A1: {
        chords: 'C | Am | Dm | G',
        lead: 'E5 E5 . C6 - B5 G5 . | C5 C5 . A5 - G5 E5 . | D5 D5 . A5 - G5 F5 . | G5 . B5 . D6 - C6 B5',
        c: 'x|.|.|.',
      },
      A2: {
        chords: 'C | Am | F G | C',
        lead: 'E5 E5 . C6 - B5 G5 . | C5 C5 . A5 - G5 E5 . | F5 . A5 . B5 . D6 . | C6 - - - . . G5 .',
        s: '....x.......x...|....x.......x...|....x.......x...|....x.......xxXX',
      },
      B: {
        chords: 'F | G | Em Am | Dm G',
        lead: 'F5 . . A5 . . C6 . | D6 . . B5 . . G5 . | G5 . . B5 . . C6 . | D6 C6 A5 F5 D5 . F5 . G5 . B5 . D6 . B5 .',
        bass: '1 . . 8 . . 5 .',
        chord: '. . 358 . . 358 . .',
        k: 'x.....x.....x...',
        c: 'x|.|.|.',
      },
    },
  },

  // 아침: 상쾌하게 깡충깡충. 한 마디를 셋잇단 12칸으로 나눠 길게-짧게 뛰는 리듬
  morning: {
    bpm: 120,
    key: 'G major',
    form: 'A1 A2 B A2',
    mix: { k: 0.12, s: 0.13, h: 0.04 },
    inst: {
      lead: { wave: 'square', vol: 0.048, vib: 10, gate: 0.8 },
      bell: { wave: 'triangle', vol: 0.05, base: 'G3', gate: 0.5, s: 0.5, d: 0.08 },
      bass: { wave: 'triangle', vol: 0.12, base: 'E2', gate: 0.6 },
    },
    bass: '1 . . 5 . . 8 . . 5 . .',
    bell: '1 3 5 8 5 3 1 3 5 8 5 3',
    k: 'x.....x.....',
    s: '...x.....x..',
    h: 'x.xx.xx.xx.x',
    sections: {
      A1: {
        chords: 'G | Em | C | D',
        lead: 'D5 - G5 B5 - G5 D6 - - . . . | E6 - D6 B5 - G5 E5 - - . . . | C6 - B5 A5 - G5 E5 - G5 A5 - B5 | A5 - - F#5 - - D5 - - . . .',
        c: 'x|.|.|.',
      },
      A2: {
        chords: 'G | Em | C D | G',
        lead: 'D5 - G5 B5 - G5 D6 - - . . . | E6 - D6 B5 - G5 E5 - - . . . | C6 - B5 A5 - G5 F#5 - G5 A5 - F#5 | G5 - - D5 - - G5 - - . . .',
      },
      B: {
        chords: 'C | G | Am | D7',
        lead: 'E6 D6 C6 G5 - - E6 D6 C6 G5 - - | D6 C6 B5 G5 - - D6 C6 B5 G5 - - | C6 B5 A5 E5 - - A5 - - C6 - - | F#5 - - A5 - - D6 - - C6 - -',
        bell: '8 . . 5 . . 3 . . 5 . .',
      },
    },
  },

  // 낮 공사장: 바쁘게 쿵쾅쿵쾅. 16분음표 망치질 같은 같은 음 되풀이와 쉬지 않는 기계 아르페지오
  day: {
    bpm: 140,
    key: 'A major',
    form: 'A1 A2 B A2',
    inst: {
      lead: { wave: 'pulse25', vol: 0.065, vib: 8, gate: 0.8 },
      arp: { wave: 'pulse12', vol: 0.03, base: 'A3', gate: 0.5, s: 0.5, d: 0.04 },
      bass: { wave: 'square', vol: 0.06, base: 'E2', gate: 0.6, lp: 900 },
    },
    bass: '1 8 1 8 1 8 1 8',
    arp: '1 3 5 8 1 3 5 8 1 3 5 8 1 3 5 8',
    k: 'x...x...x...x...',
    s: '....x.......x...',
    h: 'xxXxxxXxxxXxxxXx',
    sections: {
      A1: {
        chords: 'A | D | A | E',
        lead:
          'E5 . E5 E5 A5 . E5 . C#6 . . B5 . . A5 . | F#5 . F#5 F#5 A5 . F#5 . D6 . . C#6 . . A5 . | ' +
          'E5 . E5 E5 A5 . E5 . C#6 . . E6 . . C#6 . | B5 . . . G#5 . . . E5 . F#5 . G#5 . B5 .',
        c: 'x|.|.|.',
      },
      A2: {
        chords: 'A | D | F#m E | A',
        lead:
          'E5 . E5 E5 A5 . E5 . C#6 . . B5 . . A5 . | F#5 . F#5 F#5 A5 . F#5 . D6 . . C#6 . . A5 . | ' +
          'C#6 . C#6 C#6 A5 . F#5 . B5 . B5 B5 G#5 . E5 . | A5 . . . E5 . A5 . C#6 - - - . . . .',
      },
      B: {
        chords: 'D | E | C#m F#m | Bm E',
        lead:
          'F#5 - - A5 - - D6 - - - - - C#6 - B5 - | G#5 - - B5 - - E6 - - - - - D6 - B5 - | ' +
          'G#5 - - E5 - - C#6 - A5 - - F#5 - - C#6 - | D6 - - B5 - - F#5 - G#5 - - B5 - - E6 -',
        arp: '8 5 3 1 8 5 3 1 8 5 3 1 8 5 3 1',
        s: '....x.......x...|....x.......x...|....x.......x...|....x...x.x.xxXX',
      },
    },
  },

  // 노을 상가: 따뜻하고 살랑살랑. 16분음표 뒷박을 살짝 끄는 스윙, 7화음, 아련한 Bbm6
  sunset: {
    bpm: 108,
    key: 'F major',
    swing: 0.22,
    form: 'A1 A2 B A2',
    mix: { k: 0.15, s: 0.16, h: 0.035 },
    inst: {
      lead: { wave: 'square', vol: 0.045, vib: 18, gate: 0.92, s: 0.6, d: 0.3 },
      keys: { wave: 'pulse12', vol: 0.035, base: 'D3', gate: 0.5, s: 0.5, d: 0.08 },
      bass: { wave: 'triangle', vol: 0.12, base: 'E2', gate: 0.8 },
    },
    bass: '1 . . 1 . . 5 . 8 . . 7 . . 5 .',
    keys: '. . . . 357 . . 357 . . . . 357 . . .',
    k: 'x......x..x.....',
    s: '....x.......x.g.',
    h: 'x.xxx.xxx.xxx.xx',
    sections: {
      A1: {
        chords: 'Fmaj7 | Am7 | Bbmaj7 | C7',
        lead:
          'A5 - - G5 A5 - C6 - - - - - . . . . | E5 - - D5 E5 - G5 - - - - - . . . . | ' +
          'F5 - - D5 F5 - A5 - - - Bb5 - A5 - F5 - | G5 - - - - - E5 - - - C5 - - - . .',
      },
      A2: {
        chords: 'Fmaj7 | Am7 | Bbmaj7 C7 | F6',
        lead:
          'A5 - - G5 A5 - C6 - - - - - . . . . | E5 - - D5 E5 - G5 - - - - - . . . . | ' +
          'F5 - - D5 F5 - A5 - G5 - - E5 G5 - Bb5 - | A5 - - - - - - - . . . . . . . .',
      },
      B: {
        chords: 'Bbmaj7 | Bbm6 | Am7 D7 | Gm7 C7',
        lead:
          '. . D6 - C6 - A5 - - - F5 - - - . . | . . Db6 - C6 - G5 - - - F5 - - - . . | ' +
          'E5 - - G5 - - C6 - F#5 - - A5 - - C6 - | Bb5 - - A5 - - G5 - E5 - - G5 - - Bb5 -',
      },
    },
  },

  // 네온 밤거리: 시원한 신스, 3+3+… 엇박 리듬, 점8분음표 뒤에 따라오는 메아리
  night: {
    bpm: 118,
    key: 'A minor',
    form: 'A1 A2 B A2',
    inst: {
      lead: { wave: 'pulse25', vol: 0.065, vib: 16, gate: 0.9 },
      echo: { copy: 'lead', shift: 0.75, wave: 'pulse12', vol: 0.028, gate: 0.9 },
      arp: { wave: 'pulse12', vol: 0.028, base: 'A3', gate: 0.6, s: 0.5, d: 0.05 },
      bass: { wave: 'square', vol: 0.055, base: 'E2', gate: 0.7, lp: 700 },
    },
    bass: '1 . . 1 . . 1 . . 1 . . 8 . 5 .',
    arp: '1 5 8 1 5 8 1 5 8 1 5 8 1 5 8 5',
    k: 'x.....x...x.....',
    s: '....x.......x...',
    h: '..x...x...x...o.',
    sections: {
      A1: {
        chords: 'Am | F | C | G',
        lead:
          'E5 . . A5 . . C6 . . . B5 . A5 . . . | C6 . . A5 . . F5 . . . G5 . A5 . . . | ' +
          'E6 - - D6 - - C6 - - - G5 - - - - - | D6 - - - - - B5 - - - - - G5 - - -',
        c: 'x|.|.|.',
      },
      A2: {
        chords: 'Am | F | Dm | E',
        lead:
          'E5 . . A5 . . C6 . . . B5 . A5 . . . | C6 . . A5 . . F5 . . . G5 . A5 . . . | ' +
          'F5 . . A5 . . D6 . . . C6 . A5 . . . | B5 - - - - - G#5 - - - - - E5 - - -',
      },
      B: {
        chords: 'F | G | Em | Am',
        lead: 'C6 - - - - - A5 - | D6 - - - - - B5 - | E6 - - - - - B5 - | C6 - - - A5 - - -',
        arp: '1 3 5 8 3 5 8 5 1 3 5 8 3 5 8 5',
        bass: '1 . . . . . 1 . 8 . . . 5 . . .',
        h: 'x.x.x.x.x.x.x.o.',
        c: 'x|.|.|.',
      },
    },
  },

  // 폭풍우 고층 빌딩: 긴장되지만 신나게. 말발굽처럼 달리는 베이스, 빗방울처럼 떨어지는 아르페지오
  storm: {
    bpm: 150,
    key: 'D minor',
    form: 'A1 A2 B A2',
    inst: {
      lead: { wave: 'pulse25', vol: 0.062, vib: 10, gate: 0.85 },
      rain: { wave: 'pulse12', vol: 0.026, base: 'A3', gate: 0.5, s: 0.4, d: 0.04 },
      bass: { wave: 'square', vol: 0.055, base: 'D2', gate: 0.55, lp: 800 },
    },
    bass: '1 . 1 1 1 . 1 1 1 . 1 1 8 . 8 8',
    rain: '8 5 3 1 8 5 3 1 8 5 3 1 8 5 3 1',
    k: 'x.....x.x.....x.',
    s: '....x.......x...',
    h: 'x.x.x.x.x.x.x.x.',
    sections: {
      A1: {
        chords: 'Dm | Bb | C | A',
        lead:
          'A5 . A5 A5 A5 . A5 A5 D6 - - - C6 - A5 - | F5 . F5 F5 F5 . F5 F5 Bb5 - - - A5 - F5 - | ' +
          'G5 . G5 G5 G5 . G5 G5 C6 - - - Bb5 - G5 - | E5 . E5 E5 A5 . A5 A5 C#6 - - - E6 - - -',
        c: 'x|.|.|.',
      },
      A2: {
        chords: 'Dm | Bb | Gm A | Dm',
        lead:
          'A5 . A5 A5 A5 . A5 A5 D6 - - - C6 - A5 - | F5 . F5 F5 F5 . F5 F5 Bb5 - - - A5 - F5 - | ' +
          'Bb5 . Bb5 Bb5 G5 . D5 . C#6 . C#6 C#6 A5 . E5 . | D6 - - - A5 - - - D5 - - - . . . .',
        s: '....x.......x...|....x.......x...|....x.......x...|....x.......xxXX',
      },
      B: {
        chords: 'Gm | Eb | Bb | A',
        lead: 'D6 - Bb5 - | Eb6 - - - G5 - Bb5 - | D6 - - - F5 - Bb5 - | C#6 - - - E6 - - -',
        h: 'xxXxxxXxxxXxxxXx',
        c: 'x|.|.|.',
      },
    },
  },

  // 보스전: 급하고 씩씩한데 어딘가 우스꽝스럽게. 반음씩 미끄러져 내려오는 "와와와"
  boss: {
    bpm: 164,
    key: 'E minor',
    form: 'A1 A2 B A2',
    inst: {
      lead: { wave: 'pulse25', vol: 0.065, vib: 14, bend: 40, gate: 0.8 },
      dbl: { copy: 'lead', tr: -12, wave: 'triangle', vol: 0.05, gate: 0.8 },
      arp: { wave: 'pulse12', vol: 0.024, base: 'B3', gate: 0.5, s: 0.4, d: 0.03 },
      bass: { wave: 'square', vol: 0.055, base: 'E2', gate: 0.6, lp: 1000 },
    },
    bass: '1 1 8 1 1 1 8 1',
    arp: '1 3 5 8 1 3 5 8 1 3 5 8 1 3 5 8',
    k: 'x...x...x...x...',
    s: '....x.......x...',
    h: 'x.x.x.x.x.x.x.x.',
    sections: {
      A1: {
        chords: 'Em | C | D | B7',
        lead:
          'B4 . . E5 . . G5 . B5 - - - - - . . | C6 . B5 . C6 . B5 . G5 . E5 . G5 . . . | ' +
          'A4 . . D5 . . F#5 . A5 - - - - - . . | B5 . Bb5 . A5 . G#5 . G5 . F#5 . D#5 . . .',
        c: 'x|.|.|.',
      },
      A2: {
        chords: 'Em | C | Am B7 | Em',
        lead:
          'B4 . . E5 . . G5 . B5 - - - - - . . | C6 . B5 . C6 . B5 . G5 . E5 . G5 . . . | ' +
          'C6 . . A5 . . E5 . D#6 . . B5 . . F#5 . | E6 - - - - - B5 . E5 . . . . . . .',
        s: '....x.......x...|....x.......x...|....x.......x...|....x...x.x.xxXX',
      },
      B: {
        chords: 'C | D | Bm Em | C B7',
        lead:
          'E5 E5 G5 . E5 E5 G5 . E5 E5 G5 . C6 . . . | F#5 F#5 A5 . F#5 F#5 A5 . F#5 F#5 A5 . D6 . . . | ' +
          'D6 . B5 . F#5 . B5 . E6 . B5 . G5 . B5 . | C6 - - - G5 - - - B5 - - - A5 - - -',
        arp: '8 5 3 1 8 5 3 1 8 5 3 1 8 5 3 1',
        c: 'x|.|.|.',
      },
    },
  },

  // 엔딩: 불꽃놀이와 함께! 타이틀 후렴을 한 음 올려 다시 부르고, Bb–C–D로 힘차게 올라선다
  ending: {
    bpm: 126,
    key: 'D major',
    form: 'A1 A2 B A2',
    inst: {
      lead: { wave: 'pulse25', vol: 0.07, vib: 14, gate: 0.85 },
      chord: { wave: 'pulse12', vol: 0.045, base: 'A3', gate: 0.4, s: 0.5, d: 0.06 },
      spark: { wave: 'triangle', vol: 0.035, base: 'G4', gate: 0.5, s: 0.4, d: 0.04 },
      bass: { wave: 'triangle', vol: 0.1, base: 'E2', gate: 0.7 },
    },
    bass: '1 8 5 8 1 8 5 8',
    chord: '. 358 . 358 . 358 . 358',
    k: 'x...x...x...x...',
    s: '....x.......x...',
    h: 'x.x.x.x.x.x.x.o.',
    sections: {
      A1: {
        chords: 'D | Bm | Em | A',
        lead: 'F#5 F#5 . D6 - C#6 A5 . | D5 D5 . B5 - A5 F#5 . | E5 E5 . B5 - A5 G5 . | A5 . C#6 . E6 - D6 C#6',
        c: 'x|.|.|.',
      },
      A2: {
        chords: 'D | Bm | G A | D',
        lead: 'F#5 F#5 . D6 - C#6 A5 . | D5 D5 . B5 - A5 F#5 . | G5 . B5 . C#6 . E6 . | D6 - - - . . A5 .',
      },
      B: {
        chords: 'G | A | Bb C | D',
        lead: 'B4 . B4 B4 D5 - G5 - | C#5 . C#5 C#5 E5 - A5 - | Bb5 - - - C6 - - - | D6 - - - - - - -',
        spark: '8 5 3 5 8 5 3 5 8 5 3 5 8 5 3 5',
        s: '....x.......x...|....x.......x...|x.x.x.x.x.x.xxxx|X...x.......x...',
        c: 'x|.|.|x',
      },
    },
  },
};

// ── 악보 해석 ────────────────────────────────────────────────────────────────
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { '#': 1, b: -1 };
const CHORD = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7],
  sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 14], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14],
};
const DRUM_LANES = ['k', 's', 'h', 'c'];
const DRUM_HIT = { x: 1, X: 1.4, g: 0.45, o: 1 };
const INST_DEFAULT = { wave: 'square', vol: 0.05, base: 'C4', gate: 0.9, a: 0.004, d: 0.12, s: 0.75, r: 0.04, vib: 0, bend: 0 };

function noteMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`music: bad note "${name}"`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (ACC[m[2]] || 0);
}

function parseChord(sym) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  const iv = m && CHORD[m[3]];
  if (!iv) throw new Error(`music: bad chord "${sym}"`);
  return { pc: (PC[m[1]] + (ACC[m[2]] || 0) + 12) % 12, iv };
}

// 칸 하나 → MIDI 음 번호들
function tokenMidis(tok, chord, base) {
  if (/^[A-G]/.test(tok)) return [noteMidi(tok)];
  if (!/^([135789][',]*)+$/.test(tok)) throw new Error(`music: bad token "${tok}"`);
  const root = base + ((((chord.pc - base) % 12) + 12) % 12);
  const iv = chord.iv;
  const out = [];
  for (const [, d, mod] of tok.matchAll(/([135789])([',]*)/g)) {
    const semi = { 1: 0, 3: iv[1], 5: iv[2], 7: iv[3] ?? 12, 8: 12, 9: 14 }[d];
    let oct = 0;
    for (const ch of mod) oct += ch === ',' ? -1 : 1;
    out.push(root + semi + 12 * oct);
  }
  return out;
}

// 패턴 문자열에서 i번째 마디(구간보다 짧으면 되풀이)
const barOf = (pat, i) => {
  const bars = pat.split('|');
  return bars[i % bars.length].trim();
};

const compiled = new Map();

// 곡 하나 → { events(시간순, 초 단위: t 시작, d 길이, v 성부 + f 주파수 또는 drum + vel), loopDur, insts }
function compile(name) {
  let c = compiled.get(name);
  if (c) return c;
  const T = TRACKS[name];
  const beat = 60 / T.bpm;
  const bars = [];
  for (const sname of T.form.trim().split(/\s+/)) {
    const sec = T.sections[sname];
    if (!sec) throw new Error(`music: ${name} has no section "${sname}"`);
    sec.chords.split('|').forEach((b, i) => bars.push({ sec, i, chords: b.trim().split(/\s+/).map(parseChord) }));
  }
  const loopBeats = bars.length * 4;
  const names = Object.keys(T.inst);
  const insts = names.map((n) => ({ ...INST_DEFAULT, ...T.inst[n] }));
  const raw = []; // { b: 박 위치, len: 박 길이, v: 성부 번호, m: MIDI } 또는 { drum, vel }
  const pattern = (bar, key) => bar.sec[key] ?? T[key] ?? '';

  names.forEach((n, v) => {
    const inst = insts[v];
    if (inst.copy) return;
    const base = noteMidi(inst.base);
    let held = null; // '-'로 늘일 직전 음들
    bars.forEach((bar, bi) => {
      const pat = pattern(bar, n);
      if (!pat) return void (held = null);
      const toks = barOf(pat, bar.i).split(/\s+/);
      const step = 4 / toks.length;
      toks.forEach((tok, k) => {
        if (tok === '-') return held?.forEach((e) => (e.len += step));
        if (tok === '.') return void (held = null);
        const chord = bar.chords[Math.min(bar.chords.length - 1, Math.floor((k * step * bar.chords.length) / 4))];
        held = tokenMidis(tok, chord, base).map((m) => ({ b: bi * 4 + k * step, len: step, v, m }));
        raw.push(...held);
      });
    });
  });

  // 따라 치는 성부(메아리·겹치기)
  names.forEach((n, v) => {
    const { copy, shift = 0, tr = 0 } = insts[v];
    if (!copy) return;
    const src = names.indexOf(copy);
    if (src < 0 || insts[src].copy) throw new Error(`music: ${name}.${n} copies unknown voice "${copy}"`);
    for (const e of raw.filter((x) => x.v === src)) raw.push({ ...e, b: (e.b + shift) % loopBeats, v, m: e.m + tr });
  });

  for (const lane of DRUM_LANES) {
    bars.forEach((bar, bi) => {
      const pat = pattern(bar, lane);
      if (!pat) return;
      const cells = barOf(pat, bar.i).replace(/\s+/g, '');
      const step = 4 / cells.length;
      [...cells].forEach((ch, k) => {
        if (ch === '.') return;
        if (!DRUM_HIT[ch]) throw new Error(`music: ${name} bad drum "${ch}"`);
        raw.push({ b: bi * 4 + k * step, len: step, drum: lane === 'h' && ch === 'o' ? 'o' : lane, vel: DRUM_HIT[ch] });
      });
    });
  }

  // 스윙: 16분음표 뒷박을 살짝 늦춘다(8분음표 단위 안에서 시간을 휘게 함)
  const sw = T.swing || 0;
  const warp = (b) => {
    const u = Math.floor(b / 0.5) * 0.5;
    const x = b - u;
    return u + (x < 0.25 ? x * (1 + sw) : 0.25 * (1 + sw) + (x - 0.25) * (1 - sw));
  };
  const events = raw
    .map((e) => {
      const t0 = warp(e.b);
      const ev = { t: t0 * beat, d: (warp(e.b + e.len) - t0) * beat };
      if (e.drum) return Object.assign(ev, { drum: e.drum, vel: e.vel });
      return Object.assign(ev, { v: e.v, f: 440 * Math.pow(2, (e.m - 69) / 12) });
    })
    .sort((a, b) => a.t - b.t);
  c = { events, loopDur: loopBeats * beat, insts };
  compiled.set(name, c);
  return c;
}

// ── 소리 만들기 ──────────────────────────────────────────────────────────────
const DRUM_VOL = { k: 0.16, s: 0.2, h: 0.05, c: 0.05 };
const perCtx = new WeakMap(); // 컨텍스트마다 잡음 버퍼·펄스 파형을 한 번만 만든다

function shared(ctx) {
  let r = perCtx.get(ctx);
  if (!r) {
    const g = audioGraph();
    let noise = g && g.ctx === ctx ? g.noiseBuf : null;
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    r = { noise, waves: {} };
    perCtx.set(ctx, r);
  }
  return r;
}

// 폭이 좁은 펄스파(25%, 12.5%) — 패미컴 느낌
function pulseWave(ctx, duty) {
  const n = 64;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
    im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
  }
  return ctx.createPeriodicWave(re, im);
}

function filter(ctx, type, freq, q, to) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(to);
  return f;
}

// 곡 하나를 연주할 준비: 곡 버스, 성부 버스, 드럼 필터. t0 = 첫 박의 시각
function makeState(ctx, dest, name, t0) {
  const tr = compile(name);
  const r = shared(ctx);
  const out = ctx.createGain();
  out.connect(dest);
  const buses = tr.insts.map((inst) => {
    const g = ctx.createGain();
    g.connect(inst.lp ? filter(ctx, 'lowpass', inst.lp, 0.7, out) : out);
    return g;
  });
  const waves = tr.insts.map((inst) => {
    if (!inst.wave.startsWith('pulse')) return null;
    return (r.waves[inst.wave] ??= pulseWave(ctx, inst.wave === 'pulse12' ? 0.125 : 0.25));
  });
  return {
    ctx, tr, out, buses, waves,
    noise: r.noise,
    mix: { ...DRUM_VOL, ...TRACKS[name].mix },
    hat: filter(ctx, 'highpass', 7000, 0.7, out),
    snare: filter(ctx, 'bandpass', 1800, 0.9, out),
    idx: 0,
    loopStart: t0,
  };
}

function playNote(st, e, t) {
  const { ctx } = st;
  const inst = st.tr.insts[e.v];
  const o = ctx.createOscillator();
  if (st.waves[e.v]) o.setPeriodicWave(st.waves[e.v]);
  else o.type = inst.wave;
  o.frequency.value = e.f;
  const g = ctx.createGain();
  const p = g.gain;
  const end = t + Math.max(e.d * inst.gate, 0.03);
  const stop = end + inst.r;
  p.value = 0;
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(inst.vol, t + inst.a);
  if (inst.s < 1) p.setTargetAtTime(inst.vol * inst.s, t + inst.a, inst.d);
  p.setTargetAtTime(0, Math.max(end, t + inst.a), inst.r / 5);
  if (inst.bend) {
    o.detune.setValueAtTime(-inst.bend, t);
    o.detune.linearRampToValueAtTime(0, t + 0.05);
  }
  if (inst.vib && end - t > 0.2) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 0;
    depth.gain.setValueAtTime(0, t + 0.1);
    depth.gain.linearRampToValueAtTime(inst.vib, t + 0.3);
    lfo.connect(depth).connect(o.detune);
    lfo.start(t);
    lfo.stop(stop);
  }
  o.connect(g).connect(st.buses[e.v]);
  o.start(t);
  o.stop(stop);
}

function noiseHit(st, to, t, len, vol) {
  if (!(vol > 0)) return;
  const src = st.ctx.createBufferSource();
  src.buffer = st.noise;
  src.loop = true;
  const g = st.ctx.createGain();
  g.gain.value = vol; // 기본값 1이 시작 직전 한 샘플에 새어 나가 '틱' 튀지 않게
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(vol * 0.01, t + len);
  src.connect(g).connect(to);
  src.start(t, Math.random() * 0.9);
  src.stop(t + len + 0.01);
}

function playDrum(st, e, t) {
  const { ctx, mix } = st;
  const v = e.vel;
  if (e.drum === 'k') {
    if (!(mix.k > 0)) return;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(mix.k * v, t);
    g.gain.exponentialRampToValueAtTime(mix.k * v * 0.01, t + 0.24);
    o.connect(g).connect(st.out);
    o.start(t);
    o.stop(t + 0.25);
  } else if (e.drum === 's') noiseHit(st, st.snare, t, 0.11, mix.s * v);
  else if (e.drum === 'h') noiseHit(st, st.hat, t, 0.035, mix.h * v);
  else if (e.drum === 'o') noiseHit(st, st.hat, t, 0.2, mix.h * 0.9 * v);
  else noiseHit(st, st.hat, t, 0.9, mix.c * v);
}

// [지금까지 예약한 곳, until) 사이의 음표를 예약한다. from보다 이른(이미 지나간) 음표는 건너뛴다.
function scheduleUntil(st, until, from = -Infinity) {
  const { events, loopDur } = st.tr;
  let n = 0;
  for (;;) {
    const e = events[st.idx];
    const t = st.loopStart + e.t;
    if (t >= until) break;
    if (t >= from) {
      if (e.drum) playDrum(st, e, t);
      else playNote(st, e, t);
      n++;
    }
    if (++st.idx === events.length) {
      st.idx = 0;
      st.loopStart += loopDur;
    }
  }
  return n;
}

// 한참 뒤처졌으면(탭이 멈췄다 돌아옴 등) 밀린 음표를 버리고 지금 자리로 건너뛴다.
function skipTo(st, now) {
  const { events, loopDur } = st.tr;
  if (now > st.loopStart + loopDur) st.loopStart += Math.floor((now - st.loopStart) / loopDur) * loopDur;
  let i = events.findIndex((e) => st.loopStart + e.t >= now);
  if (i < 0) {
    i = 0;
    st.loopStart += loopDur;
  }
  st.idx = i;
}

// 오프라인 시험용: name 곡을 startTime부터 duration초 분량 dest에 예약하고, 예약한 음표 수를 돌려준다.
export function scheduleTrack(ctx, dest, name, startTime = 0, duration = 8) {
  if (!TRACKS[name]) return 0;
  const st = makeState(ctx, dest, name, startTime);
  return scheduleUntil(st, startTime + duration);
}

// ── 실시간 연주 ──────────────────────────────────────────────────────────────
const LOOKAHEAD = 0.15; // 이만큼 앞까지 미리 예약(초)
const TICK_MS = 25;
const BEHIND = 0.3; // 이보다 더 뒤처지면 건너뛴다
const LATE = 0.02; // 이보다 늦은 음표는 한꺼번에 몰려 울리지 않게 버린다
const SWITCH_FADE = 0.3;

let want = null; // 연주해야 할 곡(오디오 준비 전이면 기다린다)
let live = null; // 지금 연주 중인 곡 { name, st }
let timer = 0;
let hooked = false;
const warned = new Set();

function tick() {
  if (!live) return;
  const st = live.st;
  if (st.ctx.state !== 'running') return; // 멈춘 동안에는 아무것도 쌓지 않는다
  const now = st.ctx.currentTime;
  if (st.loopStart + st.tr.events[st.idx].t < now - BEHIND) skipTo(st, now);
  scheduleUntil(st, now + LOOKAHEAD, now - LATE);
}

function fadeOut(st, fade) {
  const now = st.ctx.currentTime;
  const g = st.out.gain;
  g.cancelScheduledValues(now);
  if (fade > 0) {
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
  } else g.setValueAtTime(0, now);
  const { out } = st; // 이 곡의 버스만 떼어 낸다(그 사이 새로 시작한 곡은 건드리지 않음)
  setTimeout(() => out.disconnect(), (fade + 0.2) * 1000);
}

function start(name) {
  const { ctx, musicBus } = audioGraph();
  const old = live;
  if (old) fadeOut(old.st, SWITCH_FADE);
  live = { name, st: makeState(ctx, musicBus, name, ctx.currentTime + (old ? 0.25 : 0.05)) };
  if (!timer) timer = setInterval(tick, TICK_MS);
  tick();
}

// 곡 name을 되풀이 연주한다. 이미 그 곡이면 아무것도 안 함(매 프레임 불러도 된다).
// 다른 곡이 나오고 있으면 빠르게 줄이고 바꾼다. 오디오 준비 전이면 기억해 두었다가 준비되면 시작.
export function playMusic(name) {
  if (!name) return stopMusic();
  if (name === want) return;
  if (!TRACKS[name]) {
    if (!warned.has(name)) console.warn(`music: unknown track "${name}"`);
    warned.add(name);
    return;
  }
  want = name;
  if (audioGraph()) start(name);
  else if (!hooked) {
    hooked = true;
    onAudioReady(() => {
      if (want && live?.name !== want) start(want);
    });
  }
}

// 지금 곡을 fade초 동안 줄이고 멈춘다.
export function stopMusic(fade = 0.4) {
  want = null;
  if (!live) return;
  fadeOut(live.st, Number.isFinite(fade) ? Math.max(0, fade) : 0.4);
  live = null;
  clearInterval(timer);
  timer = 0;
}
