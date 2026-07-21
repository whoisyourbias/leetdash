class Solution {
	public String countAndSay(int n) {
		if (n == 1) {
			return "1";
		}
		return getRle(countAndSay(n - 1));
	}

	public String getRle(String s) {
		// System.out.println("rle: of"+ s);
		String rle = "";

		int i = 0;
		int c = 0;
		char v = 0;
		while (true) {
			if (i == s.length()) {
				break;
			}

			if (v == 0) {
				v = s.charAt(i);
			}
			while (i < s.length() && s.charAt(i) == v) {
				i++;
				c++;
			}
			rle = rle.concat(String.valueOf(c)).concat(String.valueOf(v));

			v = 0;
			c = 0;
		}
		// System.out.println("rle end:" + rle);
		return rle;
	}
}
