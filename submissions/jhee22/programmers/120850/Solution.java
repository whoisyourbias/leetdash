// Character 메소드 빈출 드가자 
/*
    Character.isLetter() : 문자열 판단
    Character.isDigit() : 숫자 판단
    Character.isUpperCase() : 대문자니? 
    Character.isLowerCase() : 소문자니? 
*/ 

// ArrayList 접근 
/*
    list.add(elem) 
    list.set(idx, elem) 
    list.g
*/

// ArrayList -> 배열
/*
    (1) int[] 에 다시 담아서 넣고 돌려
    (2) stream() 이용 : arr.stream().mapToInt(Integer::intValue).toArray(); 

*/
        

import java.util.*; 
class Solution {
    public int[] solution(String my_string) {
        List <Integer> arr = new ArrayList<>(); 
        for (int i = 0; i < my_string.length(); i++) {
            if (Character.isDigit(my_string.charAt(i))) {
                arr.add(my_string.charAt(i) - '0'); 
            }
        }
        
        //ArrayList 정렬은 Collections.sort
        //int[] 배열 정렬은 Arrays.sort() 
        Collections.sort(arr); 
        
        // Stream 쓰던가 아님 int[] 에 넣고 돌리기 
        return arr.stream().mapToInt(Integer::intValue).toArray();
    }
}