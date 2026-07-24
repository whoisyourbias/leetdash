class Solution {
	public int hammingWeight(int n) {
		String binary = Integer.toBinaryString(n);

		int count = 0;
		for (char ch: binary.toCharArray()) {
			if (ch == '1') {
				count++;
			}
		}
		return count;
	}
}
