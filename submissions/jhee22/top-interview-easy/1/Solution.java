// 방법(1) : 탐색 (느림)
class Solution {
    public int[] twoSum(int[] nums, int target) {
        for(int i = 0; i < nums.length; i++){
            int value = target - nums[i];
             for(int j = i+1; j < nums.length; j++){
                if(nums[j] != value){                    
                    continue;   
                } else {
                    return new int[] {i,j};
                }
            } 
 
        }
        return new int[] {}; 
    }
}

// 방법(2): HashMap 사용하긔 
import java.util.HashMap; 
class Solution {
    public int[] twoSum(int[] nums, int target) {
        // 해쉬맵 선언 
        HashMap<Integer, Integer> map = new HashMap<>(); 

        for(int i = 0; i < nums.length; i++){
            int value = target - nums[i]; 
            // containsKey(value) : value 값에 해당되는 Key 값이 해쉬맵 안에 있는지 ? 
            if (map.containsKey(value)){
                return new int[] {map.get(value), i}; 
            }

            map.put(nums[i], i); 
        }
        return new int[] {};
    }
}