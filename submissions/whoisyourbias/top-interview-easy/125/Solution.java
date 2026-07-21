class Solution {

    public boolean isAlphaNumeric(char c) {
        if (Character.isDigit(c) || Character.isAlphabetic(c)) {
            return true;
        }
        return false;
    }

    public boolean isPalindrome(String s) {

		int i = 0;
		int j = s.length() - 1;


		while (i != j && i < j) {
			while(!isAlphaNumeric(s.charAt(i))) {
				i++;
                if (i == j  || i > j) {
				    break;
			    }
			}
			while (!isAlphaNumeric(s.charAt(j))) {
				j--;
                if (i == j  || i > j) {
				    break;
			    }
			}

			if (i == j  || i > j) {
				break;
			}

			if (Character.toLowerCase(s.charAt(j)) != Character.toLowerCase(s.charAt(i))) {
				return false;
			}

			i++;
			j--;

		}
		
		return true;
    }
}
