/**
 * 생각한 방법
 * (1) 투포인터 (배열의 위치를 기억할 두 개의 변수)-> 일단 배열 카테고리니까 배열에 충실... 
 * i : nums1에서 현재 원소 위치를 가리킴, j : nums2에서 현재 원소 위치를 가리킴 
 * (2) 해쉬-맵뿌 
 */
import java.util.Arrays; 

class Solution {
    public int[] intersect(int[] nums1, int[] nums2) {
        // (1) 배열 정렬 
        Arrays.sort(nums1); 
        Arrays.sort(nums2); 

        // (2) 각 배열의 포인터
        int i = 0; 
        int j = 0; 

        // (3) 결과 배열 초기화 및 선언 
        int[] result = new int[Math.min(nums1.length, nums2.length)]; 
        int idx = 0; 

        // (4) 둘 중 하나 디질때까지 비교 
        while(i < nums1.length && j < nums2.length){
            if (nums1[i] == nums2[j]) {
                result[idx] = nums1[i]; 
                idx++; 

                i++;
                j++; 
            } else if (nums1[i] < nums2[j]){
                i++;
            } else {
                j++; 
            }
        }

        return Arrays.copyOf(result, idx);
    } // main 
}