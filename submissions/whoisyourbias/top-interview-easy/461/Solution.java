class Solution {
    public int hammingDistance(int x, int y) {
        String xS = Integer.toBinaryString(y^x);

        System.out.println(xS);

		int c= 0;

        for (int i = 0 ; i < xS.length(); i++) {
            if (xS.charAt(i)== '1') c++;
        }
		return c;
    }
}
