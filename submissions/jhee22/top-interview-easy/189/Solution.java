class Solution {
    public void rotate(int[] nums, int k) {
        // rotate 할 새로운 배열 선언 
        int[] arr = new int[nums.length]; 
        
        for(int i=0; i<nums.length; i++){
            arr[(i+k)%nums.length] = nums[i];
        }

        // 새 배열의 값을 원래 배열의 값으로 복사
        for (int j=0; j<nums.length; j++){
            nums[j] = arr[j];
        }
    }
}