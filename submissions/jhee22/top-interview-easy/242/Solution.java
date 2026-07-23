import java.util.HashMap; 
class Solution {
    public boolean isAnagram(String s, String t) {
        HashMap<Character, Integer> count = new HashMap<>(); 
        // (1) 길이 비교 
        if(s.length() != t.length()){
            return false;
        }

        for (int i = 0; i < s.length(); i++){
            count.put(s.charAt(i), count.getOrDefault(s.charAt(i), 0) + 1); 
        }

        for (int i = 0; i < t.length(); i++){
            if(count.containsKey(t.charAt(i))){
                count.put(t.charAt(i), count.get(t.charAt(i))-1);
            }
        }


        for (int values: count.values()){
            if (values != 0) return false; 
        }
        return true; 
    }
}