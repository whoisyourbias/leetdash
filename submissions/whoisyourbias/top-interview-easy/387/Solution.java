import java.util.*;

class Solution {
    public int firstUniqChar(String s) {
    	HashMap<Character, Pair> m  = new HashMap<>();

		for (int i = 0 ; i < s.length(); i++) {
			char c = s.charAt(i);

			if (m.get(c) == null) {
				Pair p = new Pair(i);
				m.put(c, p);
			} else {
				m.get(c).increase();
			}
		}

		Pair min = new Pair(Integer.MAX_VALUE);
		for (char c : m.keySet()) {
			if (m.get(c).c == 1) {
				if (m.get(c).idx < min.idx) {
					min = m.get(c);
				}
			}
		}

        if (min.idx != Integer.MAX_VALUE) {
    		return min.idx;
        } else {
            return -1;
        }
	}

	class Pair {
		int c;
		int idx;
		Pair (int idx) {
			this.idx=idx;
			this.c = 1;
		}

		void increase() {
			this.c++;
		}
	}
}

