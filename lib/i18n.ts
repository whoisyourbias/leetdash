const sectionKo: Record<string, string> = {
  "1D DP": "1차원 DP",
  "Array": "배열",
  "Array / String": "배열 / 문자열",
  "Backtracking": "백트래킹",
  "Binary Search": "이진 탐색",
  "Binary Search Tree": "이진 탐색 트리",
  "Binary Tree - BFS": "이진 트리 - BFS",
  "Binary Tree - DFS": "이진 트리 - DFS",
  "Binary Tree BFS": "이진 트리 BFS",
  "Binary Tree General": "이진 트리 일반",
  "Bit Manipulation": "비트 조작",
  "DP - 1D": "DP - 1차원",
  "DP - Multidimensional": "DP - 다차원",
  "Design": "설계",
  "Divide & Conquer": "분할 정복",
  "Dynamic Programming": "동적 계획법",
  "Graph BFS": "그래프 BFS",
  "Graph General": "그래프 일반",
  "Graphs - BFS": "그래프 - BFS",
  "Graphs - DFS": "그래프 - DFS",
  "Hash Map / Set": "해시 맵 / 집합",
  "Hashmap": "해시 맵",
  "Heap": "힙",
  "Heap / Priority Queue": "힙 / 우선순위 큐",
  "Intervals": "구간",
  "Kadane's Algorithm": "카데인 알고리즘",
  "Linked List": "연결 리스트",
  "Math": "수학",
  "Matrix": "행렬",
  "Monotonic Stack": "단조 스택",
  "Multidimensional DP": "다차원 DP",
  "Others": "기타",
  "Prefix Sum": "누적 합",
  "Queue": "큐",
  "Sliding Window": "슬라이딩 윈도우",
  "Sorting and Searching": "정렬과 탐색",
  "Stack": "스택",
  "Strings": "문자열",
  "Trees": "트리",
  "Trie": "트라이",
  "Two Pointers": "투 포인터",
};

export function formatCatalogListTitle(title: string) {
  return title;
}

export function formatCatalogSection(section: string) {
  return sectionKo[section] ?? section;
}

export function formatProblemTitle(title: string) {
  return title;
}
