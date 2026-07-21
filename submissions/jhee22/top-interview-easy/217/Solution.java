/**
 * (1) 첫 번째 풀이 (비추) : 정렬해서 앞뒤 비교하기 -> 메모리 비효율적
import java.util.Arrays; 
class Solution {
    public boolean containsDuplicate(int[] nums) {
        int write = 0; 
        Arrays.sort(nums);
        for(int i=1; i<nums.length; i++){
            if(nums[i] == nums[i-1]){
                return true;
            }
        }
        return false; 
     
    }
}
 */

// (2) 해쉬-맵을 사용한 풀이 
import java.util.HashSet;  
class Solution {
    public boolean containsDuplicate(int[] nums) {
        HashSet<Integer> hs = new HashSet<>();
        for (int num: nums) {
            if(hs.contains(num)){
                return true;
            }
            hs.add(num);
        }
        return false;
    }
}