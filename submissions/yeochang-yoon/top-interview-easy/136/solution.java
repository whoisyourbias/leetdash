class Solution {
    public int singleNumber(int[] nums) {
        HashSet<Integer> set = new HashSet<>();

        int n = 0;
        for(int i = 0; i < nums.length; i++){
            if(set.contains(nums[i])){
                n -= nums[i];
            } else {
                set.add(nums[i]);
                n += nums[i];
            }
        }

        return n;
    }
}