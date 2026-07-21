class Solution {
    public int removeDuplicates(int[] nums) {
        // 투 포인터 변수 초기화 
        int write = 0; 
        
        for(int read=1; read<nums.length; read++){
            // 다른 값을 읽어오면 write += 1 
            if(nums[read] != nums[write]) {
                write++; 
                nums[write] = nums[read]; 
            }
        }        
        return write + 1;
    }
}