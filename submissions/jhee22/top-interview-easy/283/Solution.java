/*
    투포인터 활용
    i : 현재 배열의 위치 
    write : 0이 아닌 숫자들이 들어갈 위치 
 */
class Solution {
    public void moveZeroes(int[] nums) {
        int write = 0;
        for(int i = 0; i<nums.length; i++){
            // 0이 아닌 숫자들을 앞쪽 빈자리에 차례대로 넣기 
            if(nums[i]!=0){
                nums[write] = nums[i]; 
                write++;   
            }
        }
        // write 이후에 0 으로 채우기 
        for(int j = write; j<nums.length; j++){
                nums[j] = 0;
        }
   
    }
}
