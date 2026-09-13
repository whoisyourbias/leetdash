import java.util.ArrayList;
import java.util.Arrays;


class UserSolution {

		int curPageNo;
		ArrayList<String> pages;

		// trieNode
		Node head;

		class Node {
			String v;
			// bestImportance
			// 현재 노드까지를 prefix로 하는 단어 중에서
			// 가장 중요도가 높으면서 먼저 등록된 단어.
			String bestWord;
			int bestImportance;
			// 현재 노드가 일치하는 단어인지.
			boolean exact;

			Node[] child;

			Node(String v) {
				this.v = v;
				this.bestWord = null;
				this.bestImportance = -1;
				this.exact = false;
				this.child = new Node[26];
			}

			@Override
			public String toString() {
				return String.format("[%s, best: %s, imp: %d, ex : %b \n %s ]\n", v, bestWord, bestImportance, exact,
						Arrays.toString(child));
			}
		}

		static int charToIdx(char c) {
			return c - 'a';
		}

		// binary search로 mWord가 들어가야하는 자리 찾는다.
		private int getPosByBinarySearch(String mWord, int start, int end) {
			while (start < end) {
				int mid = start + (end - start) / 2;

				int cpt = pages.get(mid).compareTo(mWord);
				if (cpt < 0) {
					// 현재 넣을 자리가 mWord보다 작음
					start = mid + 1;
				} else {
					end = mid;
				}
			}
			return start;
		}

		public void init() {
			pages = new ArrayList<>();
			head = new Node("");
			add("a", 1);
			curPageNo = 0;
			return;
		}

		public Solution.PAGE add(String mWord, int mImportance) {
			Solution.PAGE res = new Solution.PAGE();
			res.no = -1;
			res.word = mWord;
			// @TODO 1. get position to insert by binary search in pages;
			int pos = getPosByBinarySearch(mWord, 0, pages.size());
			res.no = pos + 1;
			pages.add(pos, mWord);
			curPageNo = pos;
			// @TODO 2. update trie
			Node cur = head;
			for (char c : mWord.toCharArray()) {
				// 초기화되지 않은상태라면
				if (cur.child[charToIdx(c)] == null) {
					cur.child[charToIdx(c)] = new Node(String.valueOf(c));
				}

				// 현재노드 업데이트
				cur = cur.child[charToIdx(c)];
				// null이면 바로 업데이트
				if (cur.bestWord == null) {
					cur.bestWord = mWord;
					cur.bestImportance = mImportance;
				} else {
					// 이미 등록되어있는 경우
					// 중요도가 더 높은 경우에만 업데이트
					if (cur.bestImportance < mImportance) {
						cur.bestImportance = mImportance;
						cur.bestWord = mWord;
					}
				}
			}
			// 이 단어로 끝나는 것임을 명시.
			cur.exact = true;
			return res;
		}

		public Solution.PAGE move(int mDir) {
			Solution.PAGE res = new Solution.PAGE();
			res.no = -1;

			switch (mDir) {
				case 1:
					curPageNo += 1;
					break;
				default:
					curPageNo -= 1;
					break;
			}

			res.no = curPageNo + 1;
			res.word = pages.get(curPageNo);

			return res;
		}

		public Solution.PAGE search(String mStr) {
			Solution.PAGE res = new Solution.PAGE();
			res.no = -1;

			Node cur = head;
			for (char c : mStr.toCharArray()) {
				if (cur.child[charToIdx(c)] != null) {
					cur = cur.child[charToIdx(c)];
					continue;
				} else {
					cur = null;
					break;
				}
			}

			// 검색 실패
			if (cur == null || cur.v.equals("")) {
				return res;
			}

			// 일치하는 단어
			if (cur.exact) {
				// System.out.println(cur.v + ":" + cur.exact);
				res.word = mStr;

				// get pos
				int pos = getPosByBinarySearch(mStr, 0, pages.size());
				res.no = pos + 1;
				curPageNo = pos;
			} else {
				// prefix 일치단어.
				String bestWord = cur.bestWord;
				res.word = bestWord;
				int pos = getPosByBinarySearch(bestWord, 0, pages.size());
				res.no = pos + 1;
				curPageNo = pos;
			}

			return res;
		}

		public Solution.PAGE go(int mNo) {
			Solution.PAGE res = new Solution.PAGE();
			res.no = -1;

			curPageNo = mNo - 1;
			res.no = curPageNo + 1;
			res.word = pages.get(curPageNo);
			return res;
		}
	}