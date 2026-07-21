class Solution {
    public int singleNumber(int[] nums) {
        int result = 0; 
        for(int num: nums){
           // 같은 수의 XOR 연산 결과는 0임 
           result ^= num;
        }
        return result;
    }
}