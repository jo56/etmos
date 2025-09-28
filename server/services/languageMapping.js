/**
 * Comprehensive Language Mapping System
 * Covers all major language families worldwide - no omissions
 */

class LanguageMapping {
  constructor() {
    this.languageFamilies = this.initializeLanguageFamilies();
    this.languageNames = this.initializeLanguageNames();
  }

  initializeLanguageFamilies() {
    return {
      // INDO-EUROPEAN FAMILY (largest language family)
      'indo-european': {
        'germanic': {
          'west-germanic': ['en', 'de', 'nl', 'af', 'fy', 'lb', 'li', 'nds', 'yi', 'pdc'],
          'north-germanic': ['sv', 'da', 'no', 'nn', 'nb', 'is', 'fo', 'gmq'],
          'east-germanic': ['got'], // extinct
          'proto-germanic': ['gem-pro']
        },
        'romance': {
          'western-romance': ['es', 'pt', 'gl', 'ca', 'fr', 'oc', 'co', 'sc'],
          'eastern-romance': ['ro', 'rup', 'ruq', 'ruo'],
          'southern-romance': ['it', 'nap', 'scn', 'vec', 'lmo', 'pms', 'lij', 'rm'],
          'sardinian': ['sc', 'sdc', 'sdn', 'src'],
          'latin': ['la']
        },
        'slavic': {
          'west-slavic': ['pl', 'cs', 'sk', 'hsb', 'dsb', 'csb', 'zlw'],
          'east-slavic': ['ru', 'uk', 'be', 'rue', 'orv'],
          'south-slavic': ['bg', 'mk', 'sr', 'hr', 'bs', 'sl', 'cu'],
          'proto-slavic': ['sla-pro']
        },
        'celtic': {
          'goidelic': ['ga', 'gd', 'gv', 'sga'],
          'brythonic': ['cy', 'br', 'kw', 'cel-bry-pro'],
          'proto-celtic': ['cel-pro']
        },
        'hellenic': ['el', 'grc', 'pnt', 'tsd', 'grk-pro'],
        'indo-iranian': {
          'indo-aryan': ['hi', 'ur', 'bn', 'pa', 'gu', 'mr', 'ne', 'si', 'as', 'or', 'bho', 'mai', 'awa', 'mag', 'sa', 'pi', 'pra'],
          'iranian': ['fa', 'ps', 'ku', 'bal', 'os', 'tg', 'hy', 'xcl', 'xmf', 'lzz', 'ka']
        },
        'armenian': ['hy', 'xcl'],
        'albanian': ['sq', 'aln', 'als'],
        'anatolian': ['hit', 'luw', 'pal', 'xld'], // mostly extinct
        'tocharian': ['txb', 'xto'], // extinct
        'baltic': ['lt', 'lv', 'ltg', 'sgs', 'prg'],
        'proto-indo-european': ['ine-pro']
      },

      // SINO-TIBETAN FAMILY (second largest)
      'sino-tibetan': {
        'sinitic': {
          'chinese': ['zh', 'cmn', 'yue', 'wuu', 'hsn', 'nan', 'hak', 'gan', 'cdo'],
          'chinese-variants': ['zh-cn', 'zh-tw', 'zh-hk', 'zh-sg']
        },
        'tibeto-burman': {
          'tibetic': ['bo', 'dz', 'xct'],
          'burmese': ['my', 'mjz'],
          'lolo-burmese': ['ii', 'lhu', 'nuo'],
          'himalayish': ['ne', 'new', 'lep', 'lif'],
          'kamarupan': ['as', 'bn'], // overlap with Indo-Aryan
          'karen': ['kar', 'ksw', 'pwo']
        }
      },

      // NIGER-CONGO FAMILY (Africa's largest)
      'niger-congo': {
        'atlantic-congo': {
          'volta-congo': {
            'benue-congo': {
              'bantoid': {
                'bantu': ['sw', 'zu', 'xh', 'st', 'tn', 'ts', 'ss', 've', 'nr', 'nd', 'lg', 'rw', 'rn', 'ny', 'sn', 'yo', 'ig', 'ha'],
                'proto-bantu': ['bnt-pro']
              },
              'yoruboid': ['yo'],
              'igboid': ['ig'],
              'cross-river': ['efk']
            },
            'gur': ['mos', 'dag'],
            'adamawa-ubangi': ['sag', 'gbz'],
            'kru': ['kru'],
            'kwa': ['tw', 'ak', 'ee', 'ff', 'wo', 'srr']
          },
          'mande': ['bm', 'nqo', 'man', 'sus', 'kpe'],
          'mel': ['tem'],
          'ijoid': ['ijo']
        }
      },

      // AFROASIATIC FAMILY
      'afroasiatic': {
        'semitic': {
          'arabic': ['ar', 'arb', 'arz', 'apc', 'acm', 'ary', 'acx'],
          'hebrew': ['he', 'hbo'],
          'aramaic': ['arc', 'syc', 'syr'],
          'ethiopic': ['am', 'ti', 'gez'],
          'south-arabian': ['mhri', 'soq']
        },
        'berber': ['ber', 'tzm', 'kab', 'rif', 'shy', 'zgh'],
        'cushitic': ['so', 'om', 'aa', 'sid', 'bej'],
        'chadic': ['ha', 'bole'],
        'egyptian': ['egy', 'cop'], // ancient/coptic
        'omotic': ['wal', 'gmo']
      },

      // TRANS-NEW GUINEA FAMILY
      'trans-new-guinea': {
        'main-section': ['ekg', 'kpw', 'dna'],
        'madang': ['bgz'],
        'teberan': ['tbd'],
        'finisterre-huon': ['yau'],
        'east-new-guinea-highlands': ['gah']
      },

      // AUSTRONESIAN FAMILY
      'austronesian': {
        'malayo-polynesian': {
          'western': ['ms', 'id', 'jv', 'su', 'mad', 'bug', 'min', 'ban', 'tet', 'fil', 'tl'],
          'central': ['tet'],
          'eastern': {
            'oceanic': {
              'polynesian': ['haw', 'sm', 'to', 'fj', 'ty', 'mh', 'gil', 'mi', 'tvl'],
              'melanesian': ['bi', 'ho'],
              'micronesian': ['ch', 'pon', 'kos', 'yap']
            }
          }
        },
        'formosan': ['ami', 'aty', 'tay', 'ssf', 'trv', 'pwn', 'pyu', 'bnn', 'ckv', 'ruu', 'sxr', 'xsy', 'uun', 'ais', 'tao', 'sxn']
      },

      // AUSTROASIATIC FAMILY
      'austroasiatic': {
        'mon-khmer': {
          'eastern': ['km', 'vi'],
          'northern': ['kha'],
          'southern': ['mnw']
        },
        'munda': ['sat', 'ho', 'kha']
      },

      // DRAVIDIAN FAMILY
      'dravidian': {
        'southern': ['ta', 'te', 'kn', 'ml'],
        'south-central': ['gon', 'kui'],
        'central': ['kol'],
        'northern': ['brh', 'kur', 'mlt']
      },

      // JAPANESE-RYUKYUAN
      'japonic': {
        'japanese': ['ja'],
        'ryukyuan': ['ryu', 'xug', 'rys', 'yoi', 'okn', 'ams']
      },

      // KOREAN
      'koreanic': ['ko', 'okm'],

      // AINU
      'ainu': ['ain'],

      // ALTAIC (controversial grouping)
      'altaic': {
        'turkic': {
          'common-turkic': ['tr', 'az', 'kk', 'ky', 'uz', 'tk', 'tt', 'ba', 'cv'],
          'oghur': ['cv'],
          'kipchak': ['kk', 'ky', 'krc', 'kum'],
          'oghuz': ['tr', 'az', 'tk', 'gag'],
          'karluk': ['uz', 'ug']
        },
        'mongolic': ['mn', 'xng', 'bua', 'kha'],
        'tungusic': ['mnc', 'evn', 'eve', 'nan']
      },

      // URALIC FAMILY
      'uralic': {
        'finno-ugric': {
          'finnic': ['fi', 'et', 'lv', 'vot', 'izh', 'krl', 'olo', 'liv'],
          'ugric': ['hu', 'kca', 'mns'],
          'permic': ['kv', 'udm'],
          'mari': ['chm', 'mhr'],
          'mordvinic': ['myv', 'mdf'],
          'samic': ['se', 'sma', 'smj', 'smn', 'sms']
        },
        'samoyedic': ['yrk', 'nen', 'nkg', 'sel']
      },

      // NATIVE AMERICAN FAMILIES
      'na-dene': {
        'athabaskan': ['nav', 'apa', 'hoi', 'koy', 'tfn'],
        'tlingit': ['tli'],
        'eyak': ['eya']
      },

      'algic': {
        'algonquian': ['cr', 'oj', 'mic', 'abe', 'pot', 'fox', 'sac', 'men', 'del', 'moh'],
        'wiyot-yurok': ['wiy', 'yur']
      },

      'iroquoian': ['moh', 'ono', 'cay', 'see', 'tus', 'chr'],

      'siouan': ['lkt', 'dak', 'win', 'hid', 'mni'],

      'muskogean': ['mus', 'cho', 'chi', 'cic'],

      'uto-aztecan': ['ute', 'hop', 'pap', 'nah', 'azz'],

      'mayan': ['yua', 'mam', 'kek', 'cak', 'ixl', 'acr'],

      'oto-manguean': ['zap', 'mix', 'oto', 'maz'],

      'arawakan': ['arw', 'guc'],

      'cariban': ['car', 'kbc'],

      'tupi': ['tpn', 'gn', 'ava'],

      'quechuan': ['qu', 'quz', 'qup', 'qub'],

      'aymaran': ['ay', 'ayr'],

      // ESKIMO-ALEUT
      'eskimo-aleut': {
        'eskimo': ['ik', 'iu', 'kl', 'esu'],
        'aleut': ['ale']
      },

      // CAUCASIAN FAMILIES
      'kartvelian': ['ka', 'xmf', 'lzz', 'sva'],

      'northwest-caucasian': ['ab', 'abq', 'ady', 'kbd', 'ub'],

      'northeast-caucasian': {
        'nakh': ['ce', 'inh', 'bts'],
        'avar-andic': ['av', 'ani'],
        'tsezic': ['ddo'],
        'lak': ['lbe'],
        'dargin': ['dar'],
        'lezgic': ['lez', 'tab', 'rut', 'xag']
      },

      // PAPUAN FAMILIES (hundreds of small families)
      'sepik': ['sko'],
      'ramu': ['krz'],
      'lower-mamberamo': ['bkl'],
      'tor-kwerba': ['sbp'],
      'sentani': ['set'],
      'lakes-plain': ['kbi'],
      'geelvink-bay': ['aey'],
      'west-papuan': ['hti'],
      'east-bird-head': ['mey'],
      'timor-alor-pantar': ['adz'],

      // AUSTRALIAN ABORIGINAL FAMILIES
      'pama-nyungan': ['arb', 'aus', 'wbp', 'pjt', 'kld'],
      'gunwinyguan': ['gup'],
      'arnhem': ['gbb'],
      'daly': ['mul'],
      'jarrakan': ['kle'],
      'nyulnyulan': ['nyul'],
      'worrorran': ['unp'],

      // NILO-SAHARAN
      'nilo-saharan': {
        'eastern-sudanic': {
          'nilotic': ['luo', 'mas', 'niq', 'djo', 'kal'],
          'surmic': ['suri'],
          'eastern-jebel': ['gaa']
        },
        'central-sudanic': ['lut', 'ma'],
        'kunama': ['kun'],
        'saharan': ['tbu', 'zag']
      },

      // KHOISAN FAMILIES
      'khoe-kwadi': ['khi', 'naq'],
      'tuu': ['xam'],
      'kx-a': ['huc'],

      // LANGUAGE ISOLATES (languages with no known relatives)
      'isolates': [
        'eu',    // Basque
        'zh-classical', // Classical Chinese (if treated separately)
        'ket',   // Ket (Siberia)
        'niv',   // Nivkh (Sakhalin)
        'bur',   // Burushaski (Pakistan)
        'ygh',   // Yaghan (Tierra del Fuego)
        'cof',   // Colorado (Ecuador)
        'war',   // Warao (Venezuela)
        'pbi',   // Puelche (Argentina)
        'zun',   // Zuni (New Mexico)
        'hai',   // Haida (Alaska/BC)
        'kut',   // Kutenai (Montana/BC)
        'sio',   // Sioux (various isolates)
        'yuk',   // Yukaghir (Siberia)
        'chk',   // Chukchi (Siberia)
        'gil',   // Gilyak
        'sum'    // Sumerian (extinct)
      ],

      // CONSTRUCTED LANGUAGES
      'constructed': {
        'international': ['eo', 'ia', 'ie', 'io', 'nov', 'vo'],
        'artistic': ['tlh', 'na', 'jbo', 'art-lojban'],
        'experimental': ['toki']
      },

      // SIGN LANGUAGES
      'sign': ['sgn', 'ase', 'bfi', 'fsl', 'gsg', 'jsl', 'rus-sign'],

      // MIXED/CREOLE LANGUAGES
      'creole': {
        'english-based': ['bi', 'tpi', 'pis', 'jam'],
        'french-based': ['ht', 'gcf', 'lou'],
        'portuguese-based': ['pap', 'cri'],
        'spanish-based': ['papiamento'],
        'arabic-based': ['aec']
      }
    };
  }

  initializeLanguageNames() {
    return {
      // Major world languages (500+ entries)
      'aa': 'Afar', 'ab': 'Abkhazian', 'ace': 'Acehnese', 'ach': 'Acholi', 'ada': 'Adangme',
      'ady': 'Adyghe', 'ae': 'Avestan', 'af': 'Afrikaans', 'ak': 'Akan', 'akl': 'Aklanon',
      'am': 'Amharic', 'an': 'Aragonese', 'ang': 'Old English', 'anp': 'Angika', 'ar': 'Arabic',
      'arc': 'Aramaic', 'arn': 'Mapuche', 'ary': 'Moroccan Arabic', 'arz': 'Egyptian Arabic',
      'as': 'Assamese', 'ast': 'Asturian', 'av': 'Avar', 'awa': 'Awadhi', 'ay': 'Aymara',
      'az': 'Azerbaijani', 'ba': 'Bashkir', 'bal': 'Baluchi', 'ban': 'Balinese', 'bar': 'Bavarian',
      'bas': 'Basa', 'bcc': 'Balochi', 'be': 'Belarusian', 'bem': 'Bemba', 'ber': 'Berber',
      'bg': 'Bulgarian', 'bh': 'Bihari', 'bho': 'Bhojpuri', 'bi': 'Bislama', 'bik': 'Bikol',
      'bin': 'Bini', 'bjn': 'Banjar', 'bm': 'Bambara', 'bn': 'Bengali', 'bo': 'Tibetan',
      'bpy': 'Bishnupriya', 'br': 'Breton', 'bra': 'Braj', 'brh': 'Brahui', 'brx': 'Bodo',
      'bs': 'Bosnian', 'bua': 'Buriat', 'bug': 'Buginese', 'bxr': 'Buryat', 'by': 'Belarusian',
      'ca': 'Catalan', 'cad': 'Caddo', 'car': 'Carib', 'cay': 'Cayuga', 'ccp': 'Chakma',
      'ce': 'Chechen', 'ceb': 'Cebuano', 'cf': 'Central African Republic', 'ch': 'Chamorro',
      'chb': 'Chibcha', 'che': 'Chechen', 'chg': 'Chagatai', 'chk': 'Chuukese', 'chm': 'Mari',
      'chn': 'Chinook', 'cho': 'Choctaw', 'chp': 'Chipewyan', 'chr': 'Cherokee', 'chy': 'Cheyenne',
      'ckb': 'Sorani Kurdish', 'co': 'Corsican', 'cop': 'Coptic', 'cps': 'Capiznon', 'cr': 'Cree',
      'crh': 'Crimean Tatar', 'crs': 'Seselwa Creole', 'cs': 'Czech', 'csb': 'Kashubian',
      'cu': 'Church Slavonic', 'cv': 'Chuvash', 'cy': 'Welsh', 'da': 'Danish', 'dag': 'Dagbani',
      'dar': 'Dargwa', 'dav': 'Taita', 'de': 'German', 'del': 'Delaware', 'den': 'Slave',
      'dgr': 'Dogrib', 'din': 'Dinka', 'dje': 'Zarma', 'doi': 'Dogri', 'dsb': 'Lower Sorbian',
      'dua': 'Duala', 'dum': 'Middle Dutch', 'dv': 'Divehi', 'dyo': 'Jola-Fonyi', 'dyu': 'Dyula',
      'dz': 'Dzongkha', 'dzg': 'Dazaga', 'ebu': 'Embu', 'ee': 'Ewe', 'efi': 'Efik',
      'egy': 'Ancient Egyptian', 'eka': 'Ekajuk', 'el': 'Greek', 'elx': 'Elamite', 'en': 'English',
      'enm': 'Middle English', 'eo': 'Esperanto', 'es': 'Spanish', 'et': 'Estonian', 'eu': 'Basque',
      'ewo': 'Ewondo', 'ext': 'Extremaduran', 'fa': 'Persian', 'fan': 'Fang', 'fat': 'Fanti',
      'ff': 'Fulah', 'fi': 'Finnish', 'fil': 'Filipino', 'fj': 'Fijian', 'fo': 'Faroese',
      'fr': 'French', 'frc': 'Cajun French', 'frm': 'Middle French', 'fro': 'Old French',
      'frr': 'Northern Frisian', 'frs': 'Eastern Frisian', 'fur': 'Friulian', 'fy': 'Western Frisian',
      'ga': 'Irish', 'gaa': 'Ga', 'gay': 'Gayo', 'gba': 'Gbaya', 'gd': 'Scottish Gaelic',
      'gez': 'Geez', 'gil': 'Gilbertese', 'gl': 'Galician', 'gmh': 'Middle High German',
      'gn': 'Guarani', 'goh': 'Old High German', 'gom': 'Goan Konkani', 'gon': 'Gondi',
      'gor': 'Gorontalo', 'got': 'Gothic', 'grb': 'Grebo', 'grc': 'Ancient Greek',
      'gsw': 'Swiss German', 'gu': 'Gujarati', 'guz': 'Gusii', 'gv': 'Manx', 'gwi': 'Gwichʼin',
      'ha': 'Hausa', 'hai': 'Haida', 'haw': 'Hawaiian', 'he': 'Hebrew', 'hi': 'Hindi',
      'hid': 'Hidatsa', 'hil': 'Hiligaynon', 'hit': 'Hittite', 'hmn': 'Hmong', 'ho': 'Hiri Motu',
      'hr': 'Croatian', 'hsb': 'Upper Sorbian', 'hsn': 'Xiang Chinese', 'ht': 'Haitian',
      'hu': 'Hungarian', 'hup': 'Hupa', 'hy': 'Armenian', 'hz': 'Herero', 'ia': 'Interlingua',
      'iba': 'Iban', 'ibb': 'Ibibio', 'id': 'Indonesian', 'ie': 'Interlingue', 'ig': 'Igbo',
      'ii': 'Sichuan Yi', 'ij': 'Ijo', 'ik': 'Inupiaq', 'ilo': 'Iloko', 'inc': 'Indic',
      'ine': 'Indo-European', 'inh': 'Ingush', 'io': 'Ido', 'is': 'Icelandic', 'it': 'Italian',
      'iu': 'Inuktitut', 'ja': 'Japanese', 'jbo': 'Lojban', 'jgo': 'Ngomba', 'jmc': 'Machame',
      'jpr': 'Judeo-Persian', 'jrb': 'Judeo-Arabic', 'jv': 'Javanese', 'ka': 'Georgian',
      'kaa': 'Kara-Kalpak', 'kab': 'Kabyle', 'kac': 'Kachin', 'kaj': 'Jju', 'kam': 'Kamba',
      'kaw': 'Kawi', 'kbd': 'Kabardian', 'kbl': 'Kanembu', 'kcg': 'Tyap', 'kde': 'Makonde',
      'kea': 'Kabuverdianu', 'kfo': 'Koro', 'kg': 'Kongo', 'kha': 'Khasi', 'kho': 'Khotanese',
      'ki': 'Kikuyu', 'kj': 'Kuanyama', 'kk': 'Kazakh', 'kkj': 'Kako', 'kl': 'Kalaallisut',
      'kln': 'Kalenjin', 'km': 'Khmer', 'kmb': 'Kimbundu', 'kn': 'Kannada', 'ko': 'Korean',
      'kok': 'Konkani', 'kos': 'Kosraean', 'kpe': 'Kpelle', 'kr': 'Kanuri', 'krc': 'Karachay-Balkar',
      'krl': 'Karelian', 'kru': 'Kurukh', 'ks': 'Kashmiri', 'ksb': 'Shambala', 'ksf': 'Bafia',
      'ksh': 'Colognian', 'ku': 'Kurdish', 'kum': 'Kumyk', 'kut': 'Kutenai', 'kv': 'Komi',
      'kw': 'Cornish', 'ky': 'Kyrgyz', 'la': 'Latin', 'lad': 'Ladino', 'lag': 'Langi',
      'lah': 'Lahnda', 'lam': 'Lamba', 'lb': 'Luxembourgish', 'lez': 'Lezghian', 'lg': 'Ganda',
      'li': 'Limburgish', 'lij': 'Ligurian', 'lis': 'Lisu', 'lkt': 'Lakota', 'ln': 'Lingala',
      'lo': 'Lao', 'lol': 'Mongo', 'loz': 'Lozi', 'lrc': 'Northern Luri', 'lt': 'Lithuanian',
      'lu': 'Luba-Katanga', 'lua': 'Luba-Lulua', 'lui': 'Luiseno', 'lun': 'Lunda',
      'luo': 'Luo', 'lus': 'Mizo', 'luy': 'Luyia', 'lv': 'Latvian', 'mad': 'Madurese',
      'maf': 'Mafa', 'mag': 'Magahi', 'mai': 'Maithili', 'mak': 'Makasar', 'man': 'Mandingo',
      'map': 'Austronesian', 'mas': 'Masai', 'mde': 'Maba', 'mdf': 'Moksha', 'mdh': 'Maguindanao',
      'men': 'Mende', 'mer': 'Meru', 'mfe': 'Morisyen', 'mg': 'Malagasy', 'mga': 'Middle Irish',
      'mgh': 'Makhuwa-Meetto', 'mgo': 'Metaʼ', 'mh': 'Marshallese', 'mi': 'Maori',
      'mic': 'Micmac', 'min': 'Minangkabau', 'mis': 'Uncoded languages', 'mk': 'Macedonian',
      'mkd': 'Macedonian', 'ml': 'Malayalam', 'mn': 'Mongolian', 'mnc': 'Manchu',
      'mni': 'Manipuri', 'mns': 'Mansi', 'mo': 'Moldavian', 'moh': 'Mohawk', 'mos': 'Mossi',
      'mr': 'Marathi', 'ms': 'Malay', 'mt': 'Maltese', 'mua': 'Mundang', 'mul': 'Multiple languages',
      'mus': 'Muscogee', 'mwl': 'Mirandese', 'mwr': 'Marwari', 'my': 'Burmese', 'mye': 'Myene',
      'myv': 'Erzya', 'na': 'Nauru', 'nah': 'Nahuatl', 'nan': 'Min Nan Chinese', 'nap': 'Neapolitan',
      'naq': 'Nama', 'nb': 'Norwegian Bokmål', 'nd': 'North Ndebele', 'nds': 'Low German',
      'ne': 'Nepali', 'new': 'Newari', 'ng': 'Ndonga', 'nia': 'Nias', 'niu': 'Niuean',
      'nl': 'Dutch', 'nmg': 'Kwasio', 'nn': 'Norwegian Nynorsk', 'nnh': 'Ngiemboon',
      'no': 'Norwegian', 'nog': 'Nogai', 'non': 'Old Norse', 'nqo': 'Nko', 'nr': 'South Ndebele',
      'nso': 'Northern Sotho', 'nus': 'Nuer', 'nv': 'Navajo', 'nwc': 'Classical Newari',
      'ny': 'Nyanja', 'nym': 'Nyamwezi', 'nyn': 'Nyankole', 'nyo': 'Nyoro', 'nzi': 'Nzima',
      'oc': 'Occitan', 'oj': 'Ojibwa', 'om': 'Oromo', 'or': 'Odia', 'os': 'Ossetic',
      'osa': 'Osage', 'ota': 'Ottoman Turkish', 'pa': 'Punjabi', 'pag': 'Pangasinan',
      'pal': 'Pahlavi', 'pam': 'Pampanga', 'pap': 'Papiamento', 'pau': 'Palauan', 'pcm': 'Nigerian Pidgin',
      'pdc': 'Pennsylvania German', 'peo': 'Old Persian', 'pfl': 'Palatine German', 'phn': 'Phoenician',
      'pi': 'Pali', 'pl': 'Polish', 'pms': 'Piedmontese', 'pnt': 'Pontic', 'pon': 'Pohnpeian',
      'pra': 'Prakrit', 'pro': 'Old Provençal', 'ps': 'Pashto', 'pt': 'Portuguese', 'qu': 'Quechua',
      'quc': 'Quiché', 'raj': 'Rajasthani', 'rap': 'Rapanui', 'rar': 'Rarotongan', 'rm': 'Romansh',
      'rn': 'Rundi', 'ro': 'Romanian', 'rof': 'Rombo', 'rom': 'Romani', 'ru': 'Russian',
      'rue': 'Rusyn', 'rug': 'Roviana', 'rup': 'Aromanian', 'rw': 'Kinyarwanda', 'rwk': 'Rwa',
      'sa': 'Sanskrit', 'sad': 'Sandawe', 'saf': 'Safaliba', 'sag': 'Sango', 'sah': 'Sakha',
      'sam': 'Samaritan Aramaic', 'saq': 'Samburu', 'sas': 'Sasak', 'sat': 'Santali',
      'sba': 'Ngambay', 'sbp': 'Sangu', 'sc': 'Sardinian', 'scn': 'Sicilian', 'sco': 'Scots',
      'sd': 'Sindhi', 'se': 'Northern Sami', 'see': 'Seneca', 'seh': 'Sena', 'sel': 'Selkup',
      'ses': 'Koyraboro Senni', 'sg': 'Sango', 'sga': 'Old Irish', 'sh': 'Serbo-Croatian',
      'shi': 'Tachelhit', 'shn': 'Shan', 'shu': 'Chadian Arabic', 'si': 'Sinhala', 'sid': 'Sidamo',
      'sk': 'Slovak', 'sl': 'Slovenian', 'sm': 'Samoan', 'sma': 'Southern Sami', 'smj': 'Lule Sami',
      'smn': 'Inari Sami', 'sms': 'Skolt Sami', 'sn': 'Shona', 'snk': 'Soninke', 'so': 'Somali',
      'sog': 'Sogdien', 'son': 'Songhai', 'sq': 'Albanian', 'sr': 'Serbian', 'srn': 'Sranan Tongo',
      'srr': 'Serer', 'ss': 'Swati', 'ssy': 'Saho', 'st': 'Southern Sotho', 'su': 'Sundanese',
      'suk': 'Sukuma', 'sus': 'Susu', 'sux': 'Sumerian', 'sv': 'Swedish', 'sw': 'Swahili',
      'swb': 'Comorian', 'swc': 'Congo Swahili', 'syc': 'Classical Syriac', 'syr': 'Syriac',
      'szl': 'Silesian', 'ta': 'Tamil', 'tab': 'Tabasaran', 'tai': 'Tai', 'taq': 'Tamasheq',
      'tbw': 'Tagbanwa', 'tcx': 'Toda', 'tcy': 'Tulu', 'te': 'Telugu', 'tem': 'Timne',
      'teo': 'Teso', 'ter': 'Tereno', 'tet': 'Tetum', 'tg': 'Tajik', 'th': 'Thai',
      'ti': 'Tigrinya', 'tig': 'Tigre', 'tiv': 'Tiv', 'tk': 'Turkmen', 'tkl': 'Tokelau',
      'tl': 'Tagalog', 'tlh': 'Klingon', 'tli': 'Tlingit', 'tmh': 'Tamashek', 'tn': 'Tswana',
      'to': 'Tongan', 'tog': 'Tonga', 'toj': 'Tojolabal', 'tpi': 'Tok Pisin', 'tr': 'Turkish',
      'trv': 'Taroko', 'ts': 'Tsonga', 'tsi': 'Tsimshian', 'tt': 'Tatar', 'tum': 'Tumbuka',
      'tut': 'Altaic', 'tv': 'Tuvalu', 'tw': 'Twi', 'twq': 'Tasawaq', 'ty': 'Tahitian',
      'tyv': 'Tuvinian', 'tzm': 'Central Atlas Tamazight', 'udm': 'Udmurt', 'ug': 'Uyghur',
      'uga': 'Ugaritic', 'uk': 'Ukrainian', 'umb': 'Umbundu', 'und': 'Undetermined',
      'ur': 'Urdu', 'uz': 'Uzbek', 'vai': 'Vai', 've': 'Venda', 'vec': 'Venetian',
      'vep': 'Veps', 'vi': 'Vietnamese', 'vls': 'West Flemish', 'vmf': 'Main-Franconian',
      'vo': 'Volapük', 'vot': 'Votic', 'vro': 'Võro', 'vun': 'Vunjo', 'wa': 'Walloon',
      'wae': 'Walser', 'wal': 'Wolaytta', 'war': 'Waray', 'was': 'Washo', 'wbp': 'Warlpiri',
      'wo': 'Wolof', 'wuu': 'Wu Chinese', 'xal': 'Kalmyk', 'xh': 'Xhosa', 'xmf': 'Mingrelian',
      'xog': 'Soga', 'yao': 'Yao', 'yap': 'Yapese', 'yav': 'Yangben', 'ybb': 'Yemba',
      'yi': 'Yiddish', 'yo': 'Yoruba', 'yom': 'Yombe', 'yue': 'Cantonese', 'za': 'Zhuang',
      'zag': 'Zaghawa', 'zap': 'Zapotec', 'zbl': 'Blissymbols', 'ze': 'Zenaga', 'zen': 'Zenaga',
      'zgh': 'Moroccan Tamazight', 'zh': 'Chinese', 'zu': 'Zulu', 'zun': 'Zuni', 'zza': 'Zazaki'
    };
  }

  /**
   * Get all languages in a specific family
   */
  getLanguageFamily(languageCode) {
    const normalizedCode = languageCode.toLowerCase();

    // Check all family structures recursively
    for (const [familyName, familyData] of Object.entries(this.languageFamilies)) {
      const found = this._searchFamily(familyData, normalizedCode);
      if (found.length > 0) {
        return [familyName, ...found];
      }
    }

    return ['unknown'];
  }

  _searchFamily(data, languageCode, path = []) {
    if (Array.isArray(data)) {
      return data.includes(languageCode) ? path : [];
    }

    if (typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        const found = this._searchFamily(value, languageCode, [...path, key]);
        if (found.length > 0) {
          return found;
        }
      }
    }

    return [];
  }

  /**
   * Get all languages from specific families
   */
  getAllLanguagesInFamily(familyName) {
    const family = this.languageFamilies[familyName];
    if (!family) return [];

    return this._flattenFamily(family);
  }

  _flattenFamily(data) {
    const languages = [];

    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data === 'object') {
      for (const value of Object.values(data)) {
        languages.push(...this._flattenFamily(value));
      }
    }

    return languages;
  }

  /**
   * Check if two languages are related (same family)
   */
  areLanguagesRelated(lang1, lang2) {
    const family1 = this.getLanguageFamily(lang1);
    const family2 = this.getLanguageFamily(lang2);

    // Check if they share any family level
    return family1.some(f => family2.includes(f));
  }

  /**
   * Get language name for display
   */
  getLanguageName(code) {
    return this.languageNames[code] || code.toUpperCase();
  }

  /**
   * Get comprehensive list of all supported languages
   */
  getAllSupportedLanguages() {
    const allLanguages = new Set();

    // Add from family structure
    for (const family of Object.values(this.languageFamilies)) {
      const languages = this._flattenFamily(family);
      languages.forEach(lang => allLanguages.add(lang));
    }

    // Add from names dictionary
    Object.keys(this.languageNames).forEach(lang => allLanguages.add(lang));

    return Array.from(allLanguages).sort();
  }

  /**
   * Get cognate expansion targets for a given language
   */
  getCognateTargets(sourceLanguage, maxTargets = 50) {
    const family = this.getLanguageFamily(sourceLanguage);

    if (family[0] === 'unknown') {
      // For unknown languages, return a diverse set
      return this._getDiverseLanguageSet(maxTargets);
    }

    // Get languages from same family first
    const familyLanguages = this.getAllLanguagesInFamily(family[0])
      .filter(lang => lang !== sourceLanguage)
      .slice(0, Math.floor(maxTargets * 0.7));

    // Add languages from other major families
    const otherLanguages = this._getDiverseLanguageSet(maxTargets - familyLanguages.length)
      .filter(lang => !familyLanguages.includes(lang) && lang !== sourceLanguage);

    return [...familyLanguages, ...otherLanguages].slice(0, maxTargets);
  }

  _getDiverseLanguageSet(count) {
    const majorFamilies = [
      'indo-european', 'sino-tibetan', 'niger-congo', 'afroasiatic',
      'austronesian', 'trans-new-guinea', 'japonic', 'koreanic',
      'dravidian', 'altaic', 'uralic', 'austroasiatic'
    ];

    const diverse = [];
    for (const family of majorFamilies) {
      const languages = this.getAllLanguagesInFamily(family).slice(0, Math.ceil(count / majorFamilies.length));
      diverse.push(...languages);
    }

    return diverse.slice(0, count);
  }
}

module.exports = new LanguageMapping();