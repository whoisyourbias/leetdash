class Solution {
    public int reverseBits(int n) {
        int rtn = 0;

        int i = 0;
        while (i < 32) {
            int lastBit = n & 1;
            rtn  = (rtn << 1) | lastBit;
            n = n>>1;
            i++;
        }
        return rtn;
    }
}
