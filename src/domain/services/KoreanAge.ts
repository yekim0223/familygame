// Plan SC: SC-03 생년월일 입력 및 한국 나이 자동 계산
// 한국 나이 = 현재 연도 - 출생 연도 + 1

export function calcKoreanAge(birthDate: Date, today = new Date()): number {
  return today.getFullYear() - birthDate.getFullYear() + 1
}

export function formatNameWithAge(name: string, birthDate: Date): string {
  return `${name} · ${calcKoreanAge(birthDate)}살`
}

// 생년월일시로 Date 객체 생성
export function buildBirthDate(
  year: number, month: number, day: number
): Date {
  return new Date(year, month - 1, day)
}
