// 가족 비밀 코드 조회 컬렉션
// family_codes/{code} → { familyId, active }
// 아빠가 설정한 인간-친화적 코드로 가족을 찾는 용도
import { fsGet, fsSet, fsDelete, fsUpdate } from '../firestore'

function normalize(code: string): string {
  return code.trim().toLowerCase()
}

// 비밀코드 → familyId 조회
export async function findFamilyByCode(
  code: string
): Promise<{ familyId: string | null; error: string | null }> {
  const key = normalize(code)
  if (!key) return { familyId: null, error: '코드를 입력해줘요' }

  const { data, error } = await fsGet<{ familyId: string; active?: boolean }>(`family_codes/${key}`)
  if (error)  return { familyId: null, error }
  if (!data?.familyId || data.active === false) return { familyId: null, error: null }
  return { familyId: data.familyId, error: null }
}

// 비밀코드 설정 (아빠 전용)
// 1. 기존 코드 삭제 → 2. 신규 코드 등록 → 3. settings에 joinCode 저장
export async function setFamilyJoinCode(
  familyId: string,
  oldCode: string | null,
  newCode: string
): Promise<{ error: string | null }> {
  const normalized = normalize(newCode)
  if (normalized.length < 4) return { error: '코드는 4자 이상이어야 해요' }

  // 기존 코드 비활성화
  if (oldCode) {
    await fsDelete(`family_codes/${normalize(oldCode)}`)
  }

  // 새 코드 등록
  const { error: setErr } = await fsSet(`family_codes/${normalized}`, {
    familyId,
    active: true,
  })
  if (setErr) return { error: setErr }

  // settings에 현재 코드 저장 (관리자 패널에서 조회용)
  const { error: updateErr } = await fsUpdate(`families/${familyId}/config/settings`, {
    joinCode: normalized,
  })
  return { error: updateErr }
}
