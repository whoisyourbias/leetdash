class Solution {
    public boolean isAnagram(String s, String t) {

		if (s.length() != t.length()) {
			return false;
		}

		int[] v = new int[26];
		int[] v2 = new int[26];

		for (int i = 0; i < s.length(); i++) {
			v[s.charAt(i) - 'a'] += 1;
		}
		for (int i = 0; i < t.length(); i++) {
			v2[t.charAt(i) - 'a'] += 1;
		}

		for (int i = 0; i < v.length; i++){
			if (v[i] != v2[i]) {
				return false;
			}
		}

		return true;
	}
}
