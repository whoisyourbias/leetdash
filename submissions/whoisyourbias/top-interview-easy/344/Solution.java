class Solution {
	public void reverseString(char[] s) {
		for (int i = 0; i < s.length / 2; i++) {
			swap(s, i, s.length - 1 - i);
		}
	}

	private void swap(char[] s, int i, int j) {
		char tmp = s[i];
		s[i] = s[j];
		s[j] = tmp;
	}
}
